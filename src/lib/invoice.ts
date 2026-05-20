import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

/**
 * Sistema de numeración correlativa de facturas (compliance fiscal AEAT/UE).
 *
 * La serie por defecto se lee de `SiteSetting.invoice_series` (default 'A').
 * El número se incrementa atómicamente por (serie, año) usando UPSERT en
 * `invoice_counters`. La operación es la única vía de generar número de
 * factura — NO existe variante aleatoria. Esto garantiza:
 *
 *   - Correlación estricta sin huecos.
 *   - Sin colisiones aunque haya N writers concurrentes (el UPSERT del
 *     `(series, year)` es atómico vía UNIQUE compuesto).
 *   - Reseteo automático cada año natural.
 *
 * Formato: `<SERIE>-<YYYY>-<NNNNNNN>` (7 dígitos = 9.999.999 facturas/año).
 *
 * Importante: la operación debe ocurrir dentro de la MISMA transacción que
 * la actualización de la orden, para que si la orden hace rollback, el
 * número no quede consumido. `claimNextInvoiceNumber` exige `tx`.
 */

const NUMBER_PADDING = 7;

async function getInvoiceSeries(
    db: Prisma.TransactionClient | typeof prisma
): Promise<string> {
    const setting = await db.siteSetting.findUnique({ where: { key: 'invoice_series' } });
    const value = setting?.value?.trim() || 'A';
    // Sanitización: sólo alfanumérico (evita inyectar separadores).
    return value.replace(/[^A-Z0-9]/gi, '').slice(0, 10) || 'A';
}

/**
 * Reclama el siguiente número de factura para (serie, año actual).
 * Idempotencia: si la orden ya tiene `invoice_number`, se devuelve sin
 * incrementar el contador.
 *
 * Debe llamarse SIEMPRE dentro de una transacción.
 */
export async function claimInvoiceNumber(
    tx: Prisma.TransactionClient,
    orderId: string
): Promise<string> {
    const existing = await tx.order.findUnique({
        where: { id: orderId },
        select: { invoice_number: true }
    });
    if (existing?.invoice_number) return existing.invoice_number;

    const series = await getInvoiceSeries(tx);
    const year = new Date().getUTCFullYear();

    // UPSERT atómico: si no existe el contador, crea uno con last_number=1;
    // si existe, incrementa en 1. El UNIQUE sobre (series, year) evita
    // condiciones de carrera bajo concurrencia.
    const counter = await tx.invoiceCounter.upsert({
        where: { series_year: { series, year } },
        create: { series, year, last_number: 1 },
        update: { last_number: { increment: 1 } }
    });

    const invoiceNumber = `${series}-${year}-${String(counter.last_number).padStart(NUMBER_PADDING, '0')}`;

    await tx.order.update({
        where: { id: orderId },
        data: { invoice_number: invoiceNumber }
    });

    return invoiceNumber;
}

/**
 * Wrapper para contextos que no están dentro de una transacción.
 * Crea una transacción interna para el claim. Útil desde el endpoint de
 * descarga del PDF para órdenes legacy sin invoice_number.
 *
 * Idempotente: si la orden ya tiene número, lo devuelve sin tocar contador.
 */
export async function ensureInvoiceNumber(
    db: Prisma.TransactionClient | typeof prisma,
    orderId: string
): Promise<string> {
    // Si ya tiene número, devolver directamente sin transacción.
    const existing = await db.order.findUnique({
        where: { id: orderId },
        select: { invoice_number: true }
    });
    if (existing?.invoice_number) return existing.invoice_number;

    // Si no, abrir una transacción para el claim.
    if ('$transaction' in db) {
        return (db as typeof prisma).$transaction((tx) => claimInvoiceNumber(tx, orderId));
    }
    // Si ya estamos en transacción (recibimos `tx`), reusarla.
    return claimInvoiceNumber(db as Prisma.TransactionClient, orderId);
}
