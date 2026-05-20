import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { RETURN_WINDOW_DAYS } from '@/lib/returns';

const RETURN_STATUS_LABELS: Record<string, string> = {
    REQUESTED: 'Solicitada',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    RECEIVED: 'Recibida',
    REFUNDED: 'Reembolsada',
    CANCELLED: 'Cancelada'
};

type Props = {
    searchParams: Promise<{ return?: string }>;
};

export default async function OrdersPage({ searchParams }: Props) {
    const session = await auth();
    if (!session?.user?.email) return null;

    const sp = await searchParams;
    const justRequestedRMA = sp.return;

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return <div>Usuario no encontrado</div>;

    const orders = await prisma.order.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        include: {
            order_items: { select: { id: true } },
            returns: { select: { id: true, return_number: true, status: true, requested_at: true } }
        }
    });

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>Mis Pedidos</h1>

            {justRequestedRMA && (
                <div role="status" style={{ background: 'var(--color-success-soft, #ecfdf5)', color: 'var(--color-success, #047857)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                    ✅ Devolución <strong>{justRequestedRMA}</strong> recibida. Te avisaremos por email cuando la procesemos.
                </div>
            )}

            {orders.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Aún no has realizado ningún pedido.</p>
                    <Link href="/products" className="btn btn-primary">Empezar a comprar</Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {orders.map((order) => {
                        // Elegibilidad para devolución (mismo criterio que el endpoint).
                        const ageDays = (Date.now() - order.updated_at.getTime()) / 86_400_000;
                        const canReturn =
                            order.status === 'DELIVERED' &&
                            order.payment_status === 'PAID' &&
                            ageDays <= RETURN_WINDOW_DAYS;

                        return (
                            <div key={order.id} style={{ backgroundColor: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Pedido #{order.order_number}</h3>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                            {new Date(order.created_at).toLocaleDateString()} • {order.order_items.length} artículos
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                            {Number(order.total).toFixed(2)} €
                                        </div>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            backgroundColor: order.status === 'DELIVERED' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                            color: order.status === 'DELIVERED' ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)'
                                        }}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Devoluciones existentes para este pedido */}
                                {order.returns.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-text-secondary)' }}>
                                            Devoluciones
                                        </h4>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {order.returns.map((r) => (
                                                <li key={r.id} style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                                    <code>{r.return_number}</code> — {RETURN_STATUS_LABELS[r.status] || r.status} · {new Date(r.requested_at).toLocaleDateString()}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* CTA Devolución */}
                                {canReturn && (
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                                        <Link
                                            href={`/account/orders/${order.id}/return`}
                                            className="btn btn-outline"
                                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                                        >
                                            ↩ Solicitar devolución
                                        </Link>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginLeft: '0.75rem' }}>
                                            Ventana: {RETURN_WINDOW_DAYS} días desde la entrega
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
