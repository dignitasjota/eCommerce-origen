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

            <div className="admin-page">
                {/* Stats Cards */}
                <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon blue">📦</div>
                        <div className="admin-stat-info">
                            <h3>Productos</h3>
                            <div className="admin-stat-value">{stats.totalProducts}</div>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="admin-stat-icon green">💰</div>
                        <div className="admin-stat-info">
                            <h3>Ingresos</h3>
                            <div className="admin-stat-value">{stats.totalRevenue.toFixed(2)}€</div>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="admin-stat-icon purple">🛒</div>
                        <div className="admin-stat-info">
                            <h3>Pedidos</h3>
                            <div className="admin-stat-value">{stats.totalOrders}</div>
                        </div>
                    </div>

                    <div className="admin-stat-card">
                        <div className="admin-stat-icon orange">👥</div>
                        <div className="admin-stat-info">
                            <h3>Usuarios</h3>
                            <div className="admin-stat-value">{stats.totalUsers}</div>
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
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
                                        <Link href={`/es/admin/orders/${order.id}`} style={{ fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td>{order.users?.name || order.guest_email || '—'}</td>
                                    <td style={{ fontWeight: 600 }}>{Number(order.total).toFixed(2)}€</td>
                                    <td>
                                        <span className={`admin-badge ${order.status.toLowerCase()}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status.toLowerCase()}`}>
                                            {order.payment_status === 'PAID' ? 'Pagado' : order.payment_status === 'PENDING' ? 'Pendiente' : order.payment_status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
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
