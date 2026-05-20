import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import OrdersList from './OrdersList';
import CursorPagination from '@/components/backoffice/CursorPagination';
import {
    parseCursorParams,
    buildPrismaCursorArgs,
    buildCursorPage
} from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function asString(v: string | string[] | undefined): string | undefined {
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asDate(v: string | string[] | undefined): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

export default async function OrdersPage({ params, searchParams }: Props) {
    const { locale } = await params;
    const sp = await searchParams;

    // Cursor pagination — sustituye al offset+page anterior. En tiendas
    // con 50k+ pedidos el offset escanea decenas de miles de filas inútiles
    // por página; el cursor es siempre lineal.
    const cursorParams = parseCursorParams(sp);
    const currentCursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;

    const q = asString(sp.q);
    const statusRaw = asString(sp.status);
    const status = statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as Prisma.OrderWhereInput['status']) : undefined;
    const paymentRaw = asString(sp.paymentStatus);
    const paymentStatus = paymentRaw && (PAYMENT_STATUSES as readonly string[]).includes(paymentRaw)
        ? (paymentRaw as Prisma.OrderWhereInput['payment_status']) : undefined;
    const dateFrom = asDate(sp.dateFrom);
    const dateTo = asDate(sp.dateTo);

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
        if (dateFrom) (where.created_at as Prisma.DateTimeFilter).gte = dateFrom;
        if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            (where.created_at as Prisma.DateTimeFilter).lte = endOfDay;
        }
    }

    const cursorArgs = buildPrismaCursorArgs(cursorParams);

    // Query principal con cursor + count (count separado porque cursor no
    // tiene "total páginas" — pero seguimos mostrando el total de filtrados).
    const [rows, total] = await Promise.all([
        prisma.order.findMany({
            where,
            orderBy: { id: 'desc' },
            ...cursorArgs,
            include: {
                users: { select: { name: true, email: true } },
                order_items: { select: { id: true } },
                shipping_methods: { include: { shipping_method_translations: { where: { locale: 'es' } } } }
            }
        }),
        prisma.order.count({ where })
    ]);

    const { items: orders, nextCursor } = buildCursorPage(rows, cursorParams.take);

    const basePath = locale === 'es' ? '/admin/orders' : `/${locale}/admin/orders`;

    const filterValues = {
        q: q ?? '',
        status: statusRaw ?? '',
        paymentStatus: paymentRaw ?? '',
        dateFrom: asString(sp.dateFrom) ?? '',
        dateTo: asString(sp.dateTo) ?? ''
    };

    return (
        <>
            <OrdersList
                orders={orders}
                totalOrders={total}
                filters={filterValues}
                exportHref={`/api/admin/orders/export?${new URLSearchParams(
                    Object.entries(filterValues).filter(([, v]) => v) as [string, string][]
                ).toString()}`}
            />
            <CursorPagination
                basePath={basePath}
                currentCursor={currentCursor}
                nextCursor={nextCursor}
                extraParams={filterValues}
            />
        </>
    );
}
