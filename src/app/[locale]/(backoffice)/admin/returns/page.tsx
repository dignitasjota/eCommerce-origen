import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import AdminPagination from '@/components/backoffice/AdminPagination';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;
const STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CANCELLED'] as const;

const STATUS_LABELS: Record<string, string> = {
    REQUESTED: 'Solicitada',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    RECEIVED: 'Recibida',
    REFUNDED: 'Reembolsada',
    CANCELLED: 'Cancelada'
};

const STATUS_COLOR: Record<string, string> = {
    REQUESTED: 'inactive',
    APPROVED: 'inactive',
    REJECTED: 'inactive',
    RECEIVED: 'active',
    REFUNDED: 'active',
    CANCELLED: 'inactive'
};

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AdminReturnsPage({ params, searchParams }: Props) {
    const { locale } = await params;
    const sp = await searchParams;

    const pageRaw = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = (page - 1) * PER_PAGE;

    const statusRaw = typeof sp.status === 'string' ? sp.status : undefined;
    const status =
        statusRaw && (STATUSES as readonly string[]).includes(statusRaw)
            ? (statusRaw as (typeof STATUSES)[number])
            : undefined;

    const where: Prisma.ReturnWhereInput = status ? { status } : {};

    const [returns, total] = await Promise.all([
        prisma.return.findMany({
            where,
            orderBy: { requested_at: 'desc' },
            skip,
            take: PER_PAGE,
            include: {
                users: { select: { name: true, email: true } },
                orders: { select: { order_number: true, total: true, payment_method: true } },
                _count: { select: { return_items: true } }
            }
        }),
        prisma.return.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const basePath = locale === 'es' ? '/admin/returns' : `/${locale}/admin/returns`;

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Devoluciones · {total}</h1>
            </div>

            <div className="admin-page">
                <form
                    method="GET"
                    className="admin-card"
                    style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Estado</span>
                        <select name="status" defaultValue={statusRaw ?? ''} className="admin-form-input">
                            <option value="">Todos</option>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">
                        Filtrar
                    </button>
                    <Link href="?" className="admin-btn admin-btn-secondary admin-btn-sm">
                        Limpiar
                    </Link>
                </form>

                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>RMA</th>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Items</th>
                                <th>Total pedido</th>
                                <th>Pago</th>
                                <th>Estado</th>
                                <th>Solicitada</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {returns.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <Link href={`/es/admin/returns/${r.id}`} className="font-bold text-primary hover:underline">
                                            {r.return_number}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link href={`/es/admin/orders/${r.order_id}`} className="text-primary hover:underline">
                                            {r.orders.order_number}
                                        </Link>
                                    </td>
                                    <td>{r.users?.name || r.users?.email || '—'}</td>
                                    <td>{r._count.return_items}</td>
                                    <td>{Number(r.orders.total).toFixed(2)} €</td>
                                    <td className="text-xs">{r.orders.payment_method || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${STATUS_COLOR[r.status] || 'inactive'}`}>
                                            {STATUS_LABELS[r.status] || r.status}
                                        </span>
                                    </td>
                                    <td className="text-xs text-base-content/70">
                                        {new Date(r.requested_at).toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: '2-digit'
                                        })}
                                    </td>
                                    <td>
                                        <Link href={`/es/admin/returns/${r.id}`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                            Gestionar
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {returns.length === 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">↩️</div>
                                            <h3>Sin devoluciones</h3>
                                            <p>Cuando los clientes soliciten devoluciones aparecerán aquí.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <AdminPagination
                    basePath={basePath}
                    page={page}
                    totalPages={totalPages}
                    extraParams={{ status: statusRaw }}
                />
            </div>
        </>
    );
}
