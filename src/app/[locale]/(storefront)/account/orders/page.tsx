import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';

export default async function OrdersPage() {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) {
        return <div>Usuario no encontrado</div>;
    }

    const orders = await prisma.order.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        include: {
            order_items: true
        }
    });

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                Mis Pedidos
            </h1>

            {orders.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Aún no has realizado ningún pedido.</p>
                    <Link href="/products" className="btn btn-primary">Empezar a comprar</Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {orders.map((order) => (
                        <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
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
                    ))}
                </div>
            )}
        </div>
    );
}
