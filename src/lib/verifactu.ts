import type { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import prisma from '@/lib/db';

/**
 * Base local de cumplimiento Veri*Factu (AEAT). Ver el comentario en
 * `prisma/schema.prisma` sobre `InvoiceRecord` — esto NO es una integración
 * certificada: no firma con certificado real ni envía nada a la AEAT. Genera
 * el encadenamiento de huellas y el contenido del QR normativo, dejando el
 * sistema listo para conectar un proveedor homologado o el webservice
 * oficial cuando exista certificado.
 *
 * ⚠️ Antes de producción: validar el algoritmo exacto de huella y el formato
 * del QR contra la especificación técnica vigente de la AEAT — lo implementado
 * aquí es un encadenamiento SHA-256 razonable pero NO verificado byte a byte
 * contra el documento oficial.
 */

const CHAIN_STATE_ID = 'default';
const DEFAULT_VAT_RATE = 21;
const AEAT_QR_BASE_URL = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR';

export type InvoiceType = 'F1' | 'F2';

interface RecordFields {
    seller_tax_id: string;
    invoice_number: string;
    issued_at: Date;
    invoice_type: InvoiceType;
    taxable_base: number;
    vat_amount: number;
    total_amount: number;
}

/** Concatenación canónica + SHA-256. Ver disclaimer de compliance arriba. */
function computeHash(fields: RecordFields, previousHash: string | null): string {
    const canonical = [
        fields.seller_tax_id,
        fields.invoice_number,
        fields.issued_at.toISOString(),
        fields.invoice_type,
        fields.taxable_base.toFixed(2),
        fields.vat_amount.toFixed(2),
        fields.total_amount.toFixed(2),
        previousHash ?? ''
    ].join('|');
    return createHash('sha256').update(canonical).digest('hex');
}

function formatDDMMYYYY(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}${m}${date.getFullYear()}`;
}

/** Contenido codificado en el QR — ver disclaimer: formato aproximado, no verificado contra la spec oficial. */
function buildQrPayload(fields: RecordFields): string {
    const params = new URLSearchParams({
        nif: fields.seller_tax_id,
        numserie: fields.invoice_number,
        fecha: formatDDMMYYYY(fields.issued_at),
        importe: fields.total_amount.toFixed(2)
    });
    return `${AEAT_QR_BASE_URL}?${params.toString()}`;
}

type Client = Prisma.TransactionClient | typeof prisma;

export async function getVatRate(db: Client): Promise<number> {
    const setting = await db.siteSetting.findUnique({ where: { key: 'invoice_vat_rate' } });
    const parsed = setting?.value ? parseFloat(setting.value) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_VAT_RATE;
}

/**
 * Calcula la base imponible y la cuota de IVA a partir de un total que YA
 * incluye impuestos (precios con IVA incluido, práctica habitual en B2C
 * español) — no es un impuesto añadido sobre el total, es un desglose
 * informativo de lo que el total ya contiene.
 */
export function splitVatFromTotal(total: number, vatRate: number): { taxableBase: number; vatAmount: number } {
    const taxableBase = Math.round((total / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((total - taxableBase) * 100) / 100;
    return { taxableBase, vatAmount };
}

/**
 * Crea el registro de facturación encadenado para una orden que YA tiene
 * `invoice_number` asignado (debe llamarse dentro de la MISMA transacción
 * que `claimInvoiceNumber`, justo después). Idempotente: si la orden ya
 * tiene registro, no hace nada.
 *
 * Requiere `invoice_seller_tax_id` configurado en SiteSettings — sin NIF del
 * vendedor no se genera un registro incompleto (mejor omitirlo y quedar
 * trazado en logs que crear un registro inválido en la cadena).
 */
export async function createInvoiceRecord(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const existing = await tx.invoiceRecord.findUnique({ where: { order_id: orderId } });
    if (existing) return;

    const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
            addresses_orders_billing_address_idToaddresses: { select: { tax_id: true } },
            order_items: { select: { name: true, quantity: true } }
        }
    });
    if (!order || !order.invoice_number) return; // debe llamarse tras claimInvoiceNumber

    const sellerSetting = await tx.siteSetting.findUnique({ where: { key: 'invoice_seller_tax_id' } });
    const sellerTaxId = sellerSetting?.value?.trim();
    if (!sellerTaxId) {
        console.warn(
            `[verifactu] invoice_seller_tax_id no configurado — registro de facturación omitido para ${order.invoice_number}`
        );
        return;
    }

    const vatRate = await getVatRate(tx);
    const total = Number(order.total);
    const { taxableBase, vatAmount } = splitVatFromTotal(total, vatRate);

    const buyerTaxId = order.addresses_orders_billing_address_idToaddresses?.tax_id || null;
    const invoiceType: InvoiceType = buyerTaxId ? 'F1' : 'F2';
    const description = order.order_items.map((i) => `${i.quantity}x ${i.name}`).join(', ').slice(0, 500) || 'Venta';

    // Row lock sobre el puntero de la cadena — serializa la creación de
    // registros bajo concurrencia (dos pedidos confirmándose a la vez no
    // deben calcular el mismo previous_hash). Necesario porque, a diferencia
    // de InvoiceCounter, el valor nuevo depende del contenido del anterior,
    // no es un simple incremento atómico.
    const rows = await tx.$queryRaw<{ last_hash: string | null }[]>`
        SELECT last_hash FROM invoice_chain_state WHERE id = ${CHAIN_STATE_ID} FOR UPDATE
    `;
    const previousHash = rows[0]?.last_hash ?? null;

    const issuedAt = new Date();
    const fields: RecordFields = {
        seller_tax_id: sellerTaxId,
        invoice_number: order.invoice_number,
        issued_at: issuedAt,
        invoice_type: invoiceType,
        taxable_base: taxableBase,
        vat_amount: vatAmount,
        total_amount: total
    };
    const hash = computeHash(fields, previousHash);
    const qrPayload = buildQrPayload(fields);

    await tx.invoiceRecord.create({
        data: {
            order_id: orderId,
            invoice_number: order.invoice_number,
            issued_at: issuedAt,
            invoice_type: invoiceType,
            seller_tax_id: sellerTaxId,
            buyer_tax_id: buyerTaxId,
            taxable_base: taxableBase,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total_amount: total,
            description,
            previous_hash: previousHash,
            hash,
            qr_payload: qrPayload,
            submission_status: 'PENDING'
        }
    });

    await tx.invoiceChainState.upsert({
        where: { id: CHAIN_STATE_ID },
        create: { id: CHAIN_STATE_ID, last_hash: hash },
        update: { last_hash: hash }
    });
}

export interface ChainVerificationResult {
    ok: boolean;
    totalRecords: number;
    brokenAtInvoiceNumber?: string;
    reason?: string;
}

/**
 * Recorre toda la cadena en orden cronológico y recalcula cada huella para
 * confirmar que nadie ha alterado un registro tras crearlo (el objetivo del
 * encadenamiento: cualquier edición retroactiva rompe la cadena a partir de
 * ahí). Uso: botón "Verificar cadena" en /admin/invoicing.
 */
export async function verifyInvoiceChain(): Promise<ChainVerificationResult> {
    const records = await prisma.invoiceRecord.findMany({ orderBy: { created_at: 'asc' } });

    let previousHash: string | null = null;
    for (const r of records) {
        if ((r.previous_hash ?? null) !== previousHash) {
            return {
                ok: false,
                totalRecords: records.length,
                brokenAtInvoiceNumber: r.invoice_number,
                reason: 'previous_hash no coincide con la huella real del registro anterior'
            };
        }
        const recomputed = computeHash(
            {
                seller_tax_id: r.seller_tax_id,
                invoice_number: r.invoice_number,
                issued_at: r.issued_at,
                invoice_type: r.invoice_type as InvoiceType,
                taxable_base: Number(r.taxable_base),
                vat_amount: Number(r.vat_amount),
                total_amount: Number(r.total_amount)
            },
            previousHash
        );
        if (recomputed !== r.hash) {
            return {
                ok: false,
                totalRecords: records.length,
                brokenAtInvoiceNumber: r.invoice_number,
                reason: 'la huella almacenada no coincide con el contenido del registro — posible alteración'
            };
        }
        previousHash = r.hash;
    }

    return { ok: true, totalRecords: records.length };
}
