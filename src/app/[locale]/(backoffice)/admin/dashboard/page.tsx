import prisma from '@/lib/db';
import Link from 'next/link';

async function getStats() {
    const [totalProducts, totalOrders, totalUsers, recentOrders] = await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.user.count(),
        prisma.order.findMany({
            take: 8,
            orderBy: { created_at: 'desc' },
            include: {
                users: { select: { name: true, email: true } },
            },
        }),
    ]);

    const revenue = await prisma.order.aggregate({
        _sum: { total: true },
        where: { payment_status: 'PAID' },
    });

    return {
        totalProducts,
        totalOrders,
        totalUsers,
        totalRevenue: Number(revenue._sum.total || 0),
        recentOrders,
    };
}

export default async function DashboardPage() {
    const stats = await getStats();

    const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente',
        CONFIRMED: 'Confirmado',
        PROCESSING: 'Procesando',
        SHIPPED: 'Enviado',
        DELIVERED: 'Entregado',
        CANCELLED: 'Cancelado',
        REFUNDED: 'Reembolsado',
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Dashboard</h1>
            </div>

            <div className="admin-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* DaisyUI Stats Cards */}
                <div className="stats shadow-xl bg-base-100 w-full overflow-hidden">
                    <div className="stat">
                        <div className="stat-figure text-info text-4xl">📦</div>
                        <div className="stat-title">Productos</div>
                        <div className="stat-value text-info">{stats.totalProducts}</div>
                        <div className="stat-desc">Stock gestionado</div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-success text-4xl">💰</div>
                        <div className="stat-title">Ingresos</div>
                        <div className="stat-value text-success">{stats.totalRevenue.toFixed(2)}€</div>
                        <div className="stat-desc">Histórico validado</div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-secondary text-4xl">🛒</div>
                        <div className="stat-title">Pedidos Totales</div>
                        <div className="stat-value text-secondary">{stats.totalOrders}</div>
                        <div className="stat-desc">Procesados este mes</div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-warning text-4xl">👥</div>
                        <div className="stat-title">Usuarios</div>
                        <div className="stat-value text-warning">{stats.totalUsers}</div>
                        <div className="stat-desc">Registrados</div>
                    </div>
                </div>

                {/* Recent Orders with Custom Admin Table */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">Últimos Pedidos</h2>
                        <Link href="/es/admin/orders" className="admin-btn admin-btn-secondary admin-btn-sm">
                            Ver todos →
                        </Link>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nº Pedido</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th>Pago</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentOrders.map((order) => (
                                <tr key={order.id}>
                                    <td>
                                        <Link href={`/es/admin/orders/${order.id}`} className="font-bold text-primary hover:underline">
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td>{order.users?.name || order.guest_email || '—'}</td>
                                    <td className="font-bold">{Number(order.total).toFixed(2)}€</td>
                                    <td>
                                        <span className={`admin-badge ${order.status === 'DELIVERED' || order.status === 'SHIPPED' ? 'active' : 'inactive'}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status === 'PAID' ? 'active' : 'inactive'}`}>
                                            {order.payment_status === 'PAID' ? 'Pagado' : order.payment_status === 'PENDING' ? 'Pendiente' : order.payment_status}
                                        </span>
                                    </td>
                                    <td className="text-xs text-base-content/70">
                                        {new Date(order.created_at).toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                </tr>
                            ))}
                            {stats.recentOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📋</div>
                                            <h3>No hay pedidos aún</h3>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
