'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function OrdersList({ initialOrders }: { initialOrders: any[] }) {
    const [orders, setOrders] = useState(initialOrders);
    const [searchTerm, setSearchTerm] = useState('');

    const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PROCESSING: 'Procesando',
        SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado',
    };

    const paymentLabels: Record<string, string> = {
        PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado',
    };

    const filteredOrders = orders.filter((order) => {
        const search = searchTerm.toLowerCase();
        const orderNumberMatch = String(order.order_number).toLowerCase().includes(search);
        const nameMatch = order.users?.name?.toLowerCase().includes(search) ?? false;
        const emailMatch = order.guest_email?.toLowerCase().includes(search) ?? false;

        return orderNumberMatch || nameMatch || emailMatch;
    });

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Pedidos</h1>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="admin-table-title">{filteredOrders.length} pedidos totales</h2>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                                🔍
                            </span>
                            <input
                                type="text"
                                className="admin-form-input"
                                placeholder="Buscar por número, cliente o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', margin: 0 }}
                            />
                        </div>
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
                            {filteredOrders.map((order) => (
                                <tr key={order.id}>
                                    <td>
                                        <Link href={`/es/admin/orders/${order.id}`} className="font-bold text-primary hover:underline">
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td>{order.users?.name || order.guest_email || '—'}</td>
                                    <td>{order.order_items.length} uds.</td>
                                    <td className="font-bold">{Number(order.total).toFixed(2)}€</td>
                                    <td className="text-xs text-base-content/70">{order.shipping_methods?.shipping_method_translations[0]?.name || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${order.status === 'DELIVERED' || order.status === 'SHIPPED' ? 'active' : 'inactive'}`}>
                                            {order.status ? (statusLabels[order.status] || order.status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`admin-badge ${order.payment_status === 'PAID' ? 'active' : 'inactive'}`}>
                                            {order.payment_status ? (paymentLabels[order.payment_status] || order.payment_status) : 'Desconocido'}
                                        </span>
                                    </td>
                                    <td className="text-xs text-base-content/70">
                                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </td>
                                    <td>
                                        <Link href={`/es/admin/orders/${order.id}`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                            Gestionar
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📦</div>
                                            <h3>{searchTerm ? `No se encontraron pedidos para "${searchTerm}"` : 'Aún no has recibido ningún pedido'}</h3>
                                            <p>{searchTerm ? 'Prueba con otros términos de búsqueda.' : 'Cuando tus clientes realicen compras, aparecerán listadas aquí.'}</p>
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
