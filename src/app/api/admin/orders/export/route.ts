import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { requireAdmin, AuthorizationError } from '@/lib/auth';

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const MAX_ROWS = 10_000;

/** Escapa un valor para CSV: si contiene `,` `"` o salto de línea lo encierra en comillas y dobla comillas internas. */
function csv(value: unknown): string {
    if (value == null) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/**
 * Exporta pedidos filtrados en CSV. Usa los mismos searchParams que la lista
 * para que "exporta lo que ves" sea un contrato fiable. Limitado a 10.000
 * filas para no saturar la memoria del servidor; si en el futuro se necesita
 * más, sustituir por streaming con `findMany` por cursor.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await requireAdmin();
    } catch (e) {
        if (e instanceof AuthorizationError) {
            return NextResponse.json({ error: e.message }, { status: 403 });
        }
        throw e;
    }

    const sp = new URL(req.url).searchParams;
    const q = sp.get('q')?.trim() || undefined;
    const statusRaw = sp.get('status') || undefined;
    const paymentRaw = sp.get('paymentStatus') || undefined;
    const status = statusRaw && ORDER_STATUSES.includes(statusRaw) ? (statusRaw as any) : undefined;
    const paymentStatus = paymentRaw && PAYMENT_STATUSES.includes(paymentRaw) ? (paymentRaw as any) : undefined;
    const dateFrom = sp.get('dateFrom') ? new Date(sp.get('dateFrom')!) : undefined;
    const dateTo = sp.get('dateTo') ? new Date(sp.get('dateTo')!) : undefined;

    const where: Prisma.OrderWhereInput = {};
    if (q) {
        where.OR = [
            { order_number: { contains: q } },
            { guest_email: { contains: q } },
            { guest_name: { contains: q } },
            { users: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } }
        ];
    }
    if (status) where.status = status;
    if (paymentStatus) where.payment_status = paymentStatus;
    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom && Number.isFinite(dateFrom.getTime())) (where.created_at as Prisma.DateTimeFilter).gte = dateFrom;
        if (dateTo && Number.isFinite(dateTo.getTime())) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            (where.created_at as Prisma.DateTimeFilter).lte = endOfDay;
        }
    }

    const orders = await prisma.order.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: MAX_ROWS,
        include: {
            users: { select: { name: true, email: true } },
            order_items: { select: { id: true } }
        }
    });

    const headers = [
        'Pedido', 'Fecha', 'Estado', 'Pago', 'Cliente', 'Email', 'Items',
        'Subtotal', 'Envío', 'Descuento', 'Impuestos', 'Total', 'Cupón', 'Tracking'
    ];

    const rows = orders.map((o) => [
        o.order_number,
        o.created_at.toISOString(),
        o.status,
        o.payment_status,
        o.users?.name || o.guest_name || '',
        o.users?.email || o.guest_email || '',
        o.order_items.length,
        Number(o.subtotal).toFixed(2),
        Number(o.shipping_cost).toFixed(2),
        Number(o.discount).toFixed(2),
        Number(o.tax).toFixed(2),
        Number(o.total).toFixed(2),
        o.coupon_id || '',
        o.tracking_number || ''
    ]);

    const body = [headers, ...rows].map((cols) => cols.map(csv).join(',')).join('\r\n');
    // BOM para que Excel detecte UTF-8.
    const csvBody = '﻿' + body;

    const filename = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csvBody, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store'
        }
    });
}
