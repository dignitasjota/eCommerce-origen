'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function OrdersList({ initialOrders }: { initialOrders: any[] }) {
    const [orders, setOrders] = useState(initialOrders);

    const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PROCESSING: 'Procesando',
        SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado',
    };

    const paymentLabels: Record<string, string> = {
        PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado',
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Pedidos</h1>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{orders.length} pedidos totales</h2>
                    </div>
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
                                        <Link href={`/es/admin/orders/${order.id}`} style={{ fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td>{order.users?.name || order.guest_email || '—'}</td>
                                    <td>{order.order_items.length} uds.</td>
                                    <td style={{ fontWeight: 600 }}>{Number(order.total).toFixed(2)}€</td>
                                    <td style={{ fontSize: '0.8rem' }}>{order.shipping_methods?.shipping_method_translations[0]?.name || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${order.status?.toLowerCase() || 'pending'}`}>
                                            {order.status ? (statusLabels[order.status] || order.status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status?.toLowerCase() || 'pending'}`}>
                                            {order.payment_status ? (paymentLabels[order.payment_status] || order.payment_status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
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
                                            <h3>Aún no has recibido ningún pedido</h3>
                                            <p style={{ color: 'var(--color-text-secondary)' }}>Cuando tus clientes realicen compras, aparecerán listadas aquí.</p>
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
