import Link from 'next/link';
import prisma from '@/lib/db';
import RevenueChart from '@/components/backoffice/RevenueChart';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
    PENDING_PAYMENT: 'Esperando pago',
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmado',
    PROCESSING: 'Procesando',
    SHIPPED: 'Enviado',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
    REFUNDED: 'Reembolsado'
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const fmtDay = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
const eur = (n: number) => `${n.toFixed(2)}€`;

async function getStats() {
    const today = startOfDay(new Date());
    const last30 = addDays(today, -29);

    // Calculamos en paralelo todas las consultas que no dependen entre sí.
    const [
        totalProducts,
        totalUsers,
        totalOrdersAll,
        revenue30,
        ordersInRange,
        ordersByStatus,
        recentOrders,
        topItems
    ] = await Promise.all([
        prisma.product.count(),
        prisma.user.count(),
        prisma.order.count(),
        prisma.order.aggregate({
            _sum: { total: true },
            _count: { _all: true },
            where: { payment_status: 'PAID', created_at: { gte: last30 } }
        }),
        // Para el gráfico: traer pedidos de los últimos 30 días (sólo PAID)
        // y agruparlos en cliente por día. Con 30 días * orders/día rara vez
        // pasamos de 1.000 filas — no merece la pena groupBy en SQL.
        prisma.order.findMany({
            where: { payment_status: 'PAID', created_at: { gte: last30 } },
            select: { created_at: true, total: true }
        }),
        prisma.order.groupBy({
            by: ['status'],
            _count: { _all: true },
            orderBy: { status: 'asc' }
        }),
        prisma.order.findMany({
            take: 8,
            orderBy: { created_at: 'desc' },
            include: { users: { select: { name: true, email: true } } }
        }),
        // Top productos: agregamos OrderItem por product_id y nos quedamos con
        // los 5 más vendidos (en unidades) que aún existan.
        prisma.orderItem.groupBy({
            by: ['product_id'],
            where: { product_id: { not: null }, orders: { payment_status: 'PAID' } },
            _sum: { quantity: true, price: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
        })
    ]);

    // Series diaria de ingresos.
    const series = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
        const day = addDays(last30, i);
        series.set(fmtDay(day), 0);
    }
    for (const o of ordersInRange) {
        const key = fmtDay(startOfDay(new Date(o.created_at)));
        series.set(key, (series.get(key) || 0) + Number(o.total));
    }
    const dailyRevenue = Array.from(series.entries()).map(([label, value]) => ({ label, value }));

    // Resolver nombres y precios de los top productos.
    const topProductIds = topItems.map((t) => t.product_id!).filter(Boolean);
    const topProductData = topProductIds.length
        ? await prisma.product.findMany({
              where: { id: { in: topProductIds } },
              select: {
                  id: true,
                  slug: true,
                  product_translations: { where: { locale: 'es' }, select: { name: true } }
              }
          })
        : [];
    const productById = new Map(topProductData.map((p) => [p.id, p]));
    const topProducts = topItems.map((t) => {
        const p = productById.get(t.product_id!);
        return {
            id: t.product_id!,
            name: p?.product_translations[0]?.name || p?.slug || '—',
            slug: p?.slug,
            units: t._sum.quantity || 0,
            revenue: Number(t._sum.price || 0) * Number(t._sum.quantity || 0)
        };
    });

    const totalRevenue30 = Number(revenue30._sum.total || 0);
    const ordersPaid30 = revenue30._count._all;
    const aov30 = ordersPaid30 > 0 ? totalRevenue30 / ordersPaid30 : 0;

    return {
        totalProducts,
        totalUsers,
        totalOrdersAll,
        totalRevenue30,
        ordersPaid30,
        aov30,
        dailyRevenue,
        ordersByStatus,
        recentOrders,
        topProducts
    };
}

export default async function DashboardPage() {
    const stats = await getStats();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Dashboard</h1>
                <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                    Métricas de los últimos 30 días salvo indicación.
                </p>
            </div>

            <div className="admin-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* KPIs principales — 30 días */}
                <div className="stats shadow-xl bg-base-100 w-full overflow-hidden">
                    <div className="stat">
                        <div className="stat-figure text-success text-4xl">💰</div>
                        <div className="stat-title">Ingresos (30 d)</div>
                        <div className="stat-value text-success">{eur(stats.totalRevenue30)}</div>
                        <div className="stat-desc">Sólo pedidos PAGADOS</div>
                    </div>
                    <div className="stat">
                        <div className="stat-figure text-secondary text-4xl">🛒</div>
                        <div className="stat-title">Pedidos pagados (30 d)</div>
                        <div className="stat-value text-secondary">{stats.ordersPaid30}</div>
                        <div className="stat-desc">Total histórico: {stats.totalOrdersAll}</div>
                    </div>
                    <div className="stat">
                        <div className="stat-figure text-info text-4xl">📊</div>
                        <div className="stat-title">Ticket medio (AOV)</div>
                        <div className="stat-value text-info">{eur(stats.aov30)}</div>
                        <div className="stat-desc">Total ÷ pedidos pagados</div>
                    </div>
                    <div className="stat">
                        <div className="stat-figure text-warning text-4xl">👥</div>
                        <div className="stat-title">Usuarios</div>
                        <div className="stat-value text-warning">{stats.totalUsers}</div>
                        <div className="stat-desc">Catálogo: {stats.totalProducts} productos</div>
                    </div>
                </div>

                {/* Gráfico de ingresos diarios */}
                <div className="admin-table-container" style={{ padding: '1rem 1.5rem 1.5rem' }}>
                    <h2 className="admin-table-title" style={{ marginBottom: '0.5rem' }}>Ingresos diarios — últimos 30 días</h2>
                    <RevenueChart data={stats.dailyRevenue} formatValue={(n) => `${n.toFixed(0)}€`} />
                </div>

                {/* Distribución por estado + Top productos en dos columnas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    <div className="admin-table-container">
                        <div className="admin-table-header">
                            <h2 className="admin-table-title">Pedidos por estado</h2>
                        </div>
                        <table className="admin-table">
                            <tbody>
                                {stats.ordersByStatus.map((s) => (
                                    <tr key={s.status}>
                                        <td>{STATUS_LABELS[s.status] || s.status}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{s._count._all}</td>
                                    </tr>
                                ))}
                                {stats.ordersByStatus.length === 0 && (
                                    <tr>
                                        <td colSpan={2}>
                                            <div className="admin-empty"><h3>Aún sin pedidos</h3></div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="admin-table-container">
                        <div className="admin-table-header">
                            <h2 className="admin-table-title">Top 5 productos vendidos</h2>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th style={{ textAlign: 'right' }}>Unidades</th>
                                    <th style={{ textAlign: 'right' }}>Ingresos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.topProducts.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            {p.slug ? (
                                                <Link href={`/es/admin/products/${p.id}/edit`} className="text-primary hover:underline">
                                                    {p.name}
                                                </Link>
                                            ) : p.name}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{p.units}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{eur(p.revenue)}</td>
                                    </tr>
                                ))}
                                {stats.topProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={3}>
                                            <div className="admin-empty"><h3>Sin ventas todavía</h3></div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">Últimos pedidos</h2>
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
                                            {STATUS_LABELS[order.status] || order.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status === 'PAID' ? 'active' : 'inactive'}`}>
                                            {order.payment_status === 'PAID' ? 'Pagado' : order.payment_status === 'PENDING' ? 'Pendiente' : order.payment_status}
                                        </span>
                                    </td>
                                    <td className="text-xs text-base-content/70">
                                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                            {stats.recentOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="admin-empty"><div className="admin-empty-icon">📋</div><h3>No hay pedidos aún</h3></div>
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
