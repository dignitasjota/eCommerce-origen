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
            <div className="flex justify-between items-center mb-8 px-8 pt-8">
                <h1 className="text-3xl font-bold">Pedidos</h1>
            </div>

            <div className="px-8 pb-8">
                <div className="card bg-base-100 shadow-xl w-full">
                    <div className="card-body p-0 overflow-x-auto">
                        <div className="flex justify-between items-center p-6 border-b border-base-200">
                            <h2 className="card-title text-xl">{orders.length} pedidos totales</h2>
                        </div>
                        <table className="table table-zebra table-md w-full">
                            <thead>
                                <tr className="bg-base-200">
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
                                    <tr key={order.id} className="hover">
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
                                            <div className="badge badge-outline">
                                                {order.status ? (statusLabels[order.status] || order.status) : 'Desconocido'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`badge ${order.payment_status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                                                {order.payment_status ? (paymentLabels[order.payment_status] || order.payment_status) : 'Desconocido'}
                                            </div>
                                        </td>
                                        <td className="text-xs text-base-content/70">
                                            {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td>
                                            <Link href={`/es/admin/orders/${order.id}`} className="btn btn-outline btn-sm">
                                                Gestionar
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-10 text-base-content/50">
                                            <div className="text-5xl mb-4">📦</div>
                                            <h3 className="text-lg font-bold">Aún no has recibido ningún pedido</h3>
                                            <p>Cuando tus clientes realicen compras, aparecerán listadas aquí.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
