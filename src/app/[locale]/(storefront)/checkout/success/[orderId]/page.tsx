import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';

export const metadata = {
    title: 'Pedido Confirmado | eShop',
};

interface SuccessPageProps {
    params: Promise<{
        locale: string;
        orderId: string;
    }>;
}

export default async function CheckoutSuccessPage({ params }: SuccessPageProps) {
    const { locale, orderId } = await params;

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            order_items: true,
            shipping_methods: {
                include: {
                    shipping_method_translations: {
                        where: { locale }
                    }
                }
            },
            addresses_orders_shipping_address_idToaddresses: true,
            users: true
        }
    });

    if (!order) {
        notFound();
    }

    const shippingAddress = order.addresses_orders_shipping_address_idToaddresses;
    const shippingMethodName = order.shipping_methods?.shipping_method_translations[0]?.name || 'Estándar';

    return (
        <div className="container" style={{ padding: '6rem 1rem', maxWidth: '800px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-success)', color: 'white', marginBottom: '1.5rem' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>¡Gracias por tu compra!</h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Hemos recibido correctamente tu pedido <strong>{order.order_number}</strong>.
                </p>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    Se ha enviado un correo electrónico de confirmación a {order.guest_email || order.users?.email || 'tu dirección de correo'}.
                </p>
            </div>

            <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>Resumen del Pedido</h2>

                {/* Ítems */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                    {order.order_items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <div>
                                <h3 style={{ fontWeight: 'bold', fontSize: '1rem' }}>{item.quantity}x {item.name}</h3>
                                {item.variant_info && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                                        {Object.entries(JSON.parse(item.variant_info)).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                    </div>
                                )}
                            </div>
                            <div style={{ fontWeight: 'bold' }}>
                                {(Number(item.price) * item.quantity).toFixed(2)} €
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totales */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Subtotal</span>
                        <span>{Number(order.subtotal).toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Envío ({shippingMethodName})</span>
                        <span>{Number(order.shipping_cost) === 0 ? 'Gratis' : `${Number(order.shipping_cost).toFixed(2)} €`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <span>Total pagado</span>
                        <span style={{ color: 'var(--color-primary)' }}>{Number(order.total).toFixed(2)} €</span>
                    </div>
                </div>

                {/* Info adicional de envío y pago */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', backgroundColor: 'var(--color-background)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                    <div>
                        <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Información de Envío</h4>
                        {shippingAddress ? (
                            <address style={{ fontStyle: 'normal', color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {shippingAddress.first_name} {shippingAddress.last_name}<br />
                                {shippingAddress.address1} {shippingAddress.address2 ? `, ${shippingAddress.address2}` : ''}<br />
                                {shippingAddress.postal_code} {shippingAddress.city}<br />
                                {shippingAddress.state}, {shippingAddress.country}<br />
                                {shippingAddress.phone && `Tel: ${shippingAddress.phone}`}
                            </address>
                        ) : (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Dirección no disponible.</p>
                        )}
                    </div>
                    <div>
                        <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Método de Pago</h4>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {order.payment_method === 'COD' ? 'Pago a la Entrega (Contrareembolso)' : 'Transferencia Bancaria'}<br />
                            <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--color-warning)', color: '#856404', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                Estado: PENDIENTE
                            </span>
                        </p>
                        {order.payment_method === 'TRANSFER' && (
                            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                                Recibirás un email con nuestras coordenadas bancarias para procesar el pago.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                <Link href="/" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>
                    Volver al Inicio
                </Link>
            </div>

        </div>
    );
}
