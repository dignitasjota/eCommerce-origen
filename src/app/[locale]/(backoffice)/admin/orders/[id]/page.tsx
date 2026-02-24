import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import { getOrderStatusUpdateEmailHtml } from '@/lib/emails/order-status-update';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
    const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
            users: true,
            shipping_methods: { include: { shipping_method_translations: { where: { locale: 'es' } } } },
            addresses_orders_shipping_address_idToaddresses: true,
            order_items: {
                include: {
                    products: true,
                    product_variants: true
                }
            }
        }
    });

    if (!order) {
        notFound();
    }

    const statusLabels: Record<string, string> = {
        PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PROCESSING: 'Procesando',
        SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado',
    };

    const paymentLabels: Record<string, string> = {
        PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado',
    };

    // Server Action para actualizar el estado
    async function updateOrderStatus(formData: FormData) {
        'use server';
        const newStatus = formData.get('status') as string;

        if (!newStatus || newStatus === order?.status) return;

        await prisma.order.update({
            where: { id: params.id },
            data: { status: newStatus as any }
        });

        // 📧 Fase 8: Enviar Email al Cliente sobre el cambio de estado
        try {
            const customerEmail = order?.users?.email || order?.guest_email;
            const customerName = order?.users?.name || order?.guest_name || 'Cliente';

            if (customerEmail) {
                await sendEmail({
                    to: customerEmail,
                    subject: `Actualización de tu Pedido #${order?.order_number}`,
                    html: getOrderStatusUpdateEmailHtml(order?.order_number || '', customerName, newStatus)
                });
            }
        } catch (emailError) {
            console.error('Error al enviar email de actualización de estado:', emailError);
        }

        revalidatePath(`/es/admin/orders/${params.id}`);
        revalidatePath(`/es/admin/orders`);
    }

    // Calcula el subtotal reconstruido
    const itemsSubtotal = order.order_items.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);

    return (
        <>
            <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Link href="/es/admin/orders" style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block' }}>
                        &larr; Volver a pedidos
                    </Link>
                    <h1 className="admin-topbar-title">Pedido {order.order_number}</h1>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <span className={`admin-badge ${order.status.toLowerCase()}`}>{statusLabels[order.status] || order.status}</span>
                    <span className={`admin-badge ${order.payment_status.toLowerCase()}`}>{paymentLabels[order.payment_status] || order.payment_status}</span>
                </div>
            </div>

            <div className="admin-page" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>

                {/* Columna Izquierda: Items y Detalles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    <div className="admin-table-container">
                        <div className="admin-table-header">
                            <h2 className="admin-table-title">Artículos del Pedido</h2>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Precio Ud.</th>
                                    <th>Cantidad</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.order_items.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.products?.slug || item.product_id}</div>
                                            {item.variant_info && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Variante: {item.variant_info}</div>}
                                        </td>
                                        <td>{Number(item.price).toFixed(2)}€</td>
                                        <td>{item.quantity}</td>
                                        <td style={{ fontWeight: 600 }}>{(Number(item.price) * item.quantity).toFixed(2)}€</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', padding: '1rem' }}>Subtotal:</td>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{itemsSubtotal.toFixed(2)}€</td>
                                </tr>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', padding: '1rem' }}>Envío ({order.shipping_methods?.shipping_method_translations[0]?.name}):</td>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{Number(order.shipping_cost).toFixed(2)}€</td>
                                </tr>
                                <tr style={{ backgroundColor: 'var(--color-background-soft)' }}>
                                    <td colSpan={3} style={{ textAlign: 'right', padding: '1.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>Total General:</td>
                                    <td style={{ padding: '1.5rem', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{Number(order.total).toFixed(2)}€</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                </div>

                {/* Columna Derecha: Cliente y Acciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Actualizar Estado */}
                    <div className="admin-table-container" style={{ padding: '1.5rem' }}>
                        <h2 className="admin-table-title" style={{ marginBottom: '1rem' }}>Gestionar Pedido</h2>
                        <form action={updateOrderStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Estado del Pedido (Cambiar notificará al cliente)</label>
                                <select name="status" defaultValue={order.status} className="admin-input">
                                    {Object.entries(statusLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%' }}>
                                Actualizar Estado
                            </button>
                        </form>
                    </div>

                    {/* Datos del Cliente */}
                    <div className="admin-table-container" style={{ padding: '1.5rem' }}>
                        <h2 className="admin-table-title" style={{ marginBottom: '1rem' }}>Cliente</h2>
                        {order.users ? (
                            <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                                <p><strong>Nombre:</strong> {order.users.name}</p>
                                <p><strong>Email:</strong> {order.users.email}</p>
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                                <span className="admin-badge">Usuario Invitado</span>
                                <p style={{ marginTop: '0.5rem' }}><strong>Nombre:</strong> {order.guest_name}</p>
                                <p><strong>Email:</strong> {order.guest_email}</p>
                            </div>
                        )}
                    </div>

                    {/* Dirección de Envío */}
                    <div className="admin-table-container" style={{ padding: '1.5rem' }}>
                        <h2 className="admin-table-title" style={{ marginBottom: '1rem' }}>Dirección de Envío</h2>
                        {order.addresses_orders_shipping_address_idToaddresses ? (
                            <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                                <p>{order.addresses_orders_shipping_address_idToaddresses.first_name} {order.addresses_orders_shipping_address_idToaddresses.last_name}</p>
                                <p>{order.addresses_orders_shipping_address_idToaddresses.address1}</p>
                                {order.addresses_orders_shipping_address_idToaddresses.address2 && <p>{order.addresses_orders_shipping_address_idToaddresses.address2}</p>}
                                <p>{order.addresses_orders_shipping_address_idToaddresses.postal_code} {order.addresses_orders_shipping_address_idToaddresses.city}</p>
                                <p>{order.addresses_orders_shipping_address_idToaddresses.state}, {order.addresses_orders_shipping_address_idToaddresses.country}</p>
                                <p>Tel: {order.addresses_orders_shipping_address_idToaddresses.phone}</p>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-tertiary)' }}>No hay dirección registrada.</p>
                        )}
                    </div>

                </div>

            </div>
        </>
    );
}
