import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin, AuthorizationError } from '@/lib/auth';

const MAX_ROWS = 10_000;

/** Escapa un valor para CSV: si contiene `,` `"` o salto de línea lo encierra en comillas y dobla comillas internas. */
function csv(value: unknown): string {
    if (value == null) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/**
 * Exporta el registro de facturación Veri*Factu (base local, ver
 * src/lib/verifactu.ts) en CSV — estructura propia para revisión/contabilidad,
 * NO el XML oficial "registro de facturación" del SII/Veri*Factu. Adaptar al
 * formato exacto que exija el proveedor u organismo antes de un envío real.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await requireAdmin(undefined, 'invoicing.view');
    } catch (e) {
        if (e instanceof AuthorizationError) {
            return NextResponse.json({ error: e.message }, { status: 403 });
        }
        throw e;
    }

    const records = await prisma.invoiceRecord.findMany({
        orderBy: { created_at: 'asc' },
        take: MAX_ROWS,
        include: { orders: { select: { order_number: true } } }
    });

    const headers = [
        'Fecha emisión', 'Nº factura', 'Pedido', 'Tipo', 'NIF vendedor', 'NIF comprador',
        'Base imponible', 'Tipo IVA', 'Cuota IVA', 'Total', 'Descripción',
        'Huella anterior', 'Huella', 'Estado envío'
    ];

    const rows = records.map((r) => [
        r.issued_at.toISOString(),
        r.invoice_number,
        r.orders.order_number,
        r.invoice_type,
        r.seller_tax_id,
        r.buyer_tax_id || '',
        Number(r.taxable_base).toFixed(2),
        `${Number(r.vat_rate)}%`,
        Number(r.vat_amount).toFixed(2),
        Number(r.total_amount).toFixed(2),
        r.description,
        r.previous_hash || '',
        r.hash,
        r.submission_status
    ]);

    const body = [headers, ...rows].map((cols) => cols.map(csv).join(',')).join('\r\n');
    const csvBody = '﻿' + body; // BOM para que Excel detecte UTF-8.

    const filename = `registro-facturacion-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csvBody, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store'
        }
    });
}
