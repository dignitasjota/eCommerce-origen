import Link from 'next/link';

interface FilterValues {
    q: string;
    status: string;
    paymentStatus: string;
    dateFrom: string;
    dateTo: string;
}

interface OrderForList {
    id: string;
    order_number: string;
    status: string | null;
    payment_status: string | null;
    total: any;
    created_at: Date;
    guest_email: string | null;
    users: { name: string | null; email: string } | null;
    order_items: { id: string }[];
    shipping_methods: { shipping_method_translations: { name: string }[] } | null;
}

interface Props {
    orders: OrderForList[];
    totalOrders: number;
    filters: FilterValues;
    exportHref: string;
}

const STATUS_LABELS: Record<string, string> = {
    PENDING_PAYMENT: 'Esperando pago', PENDING: 'Pendiente', CONFIRMED: 'Confirmado',
    PROCESSING: 'Procesando', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado'
};

const PAYMENT_LABELS: Record<string, string> = {
    PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado'
};

/**
 * Listado de pedidos con filtros server-side. Es un Server Component: el
 * filtro se aplica vía form `method="GET"` que actualiza la URL y deja que
 * Next refresque los datos. Sin estado local de búsqueda.
 */
export default function OrdersList({ orders, totalOrders, filters, exportHref }: Props) {
    return (
        <>
            <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 className="admin-topbar-title">Pedidos · {totalOrders}</h1>
                <a href={exportHref} className="admin-btn admin-btn-secondary admin-btn-sm" download>
                    ⬇ Exportar CSV
                </a>
            </div>

            <div className="admin-page">
                <form
                    method="GET"
                    className="admin-card"
                    style={{ marginBottom: '1.5rem', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Buscar</span>
                        <input
                            type="text"
                            name="q"
                            defaultValue={filters.q}
                            placeholder="Número, cliente, email…"
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Estado</span>
                        <select name="status" defaultValue={filters.status} className="admin-form-input">
                            <option value="">Todos</option>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Pago</span>
                        <select name="paymentStatus" defaultValue={filters.paymentStatus} className="admin-form-input">
                            <option value="">Todos</option>
                            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Desde</span>
                        <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className="admin-form-input" />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Hasta</span>
                        <input type="date" name="dateTo" defaultValue={filters.dateTo} className="admin-form-input" />
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">Filtrar</button>
                        <Link href="?" className="admin-btn admin-btn-secondary admin-btn-sm">Limpiar</Link>
                    </div>
                </form>

                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nº Pedido</th>
                                <th>Cliente</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Envío</th>
                                <th>Estado</th>
                                <th>Pago</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td>
                                        <Link href={`/es/admin/orders/${order.id}`} className="font-bold text-primary hover:underline">
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td>{order.users?.name || order.users?.email || order.guest_email || '—'}</td>
                                    <td>{order.order_items.length} uds.</td>
                                    <td className="font-bold">{Number(order.total).toFixed(2)}€</td>
                                    <td className="text-xs text-base-content/70">{order.shipping_methods?.shipping_method_translations[0]?.name || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${order.status === 'DELIVERED' || order.status === 'SHIPPED' ? 'active' : 'inactive'}`}>
                                            {order.status ? (STATUS_LABELS[order.status] || order.status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status === 'PAID' ? 'active' : 'inactive'}`}>
                                            {order.payment_status ? (PAYMENT_LABELS[order.payment_status] || order.payment_status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td className="text-xs text-base-content/70">
                                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                                    </td>
                                    <td>
                                        <Link href={`/es/admin/orders/${order.id}`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                            Gestionar
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📦</div>
                                            <h3>No se encontraron pedidos con esos filtros</h3>
                                            <p>Ajusta o limpia los filtros para ver más resultados.</p>
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
