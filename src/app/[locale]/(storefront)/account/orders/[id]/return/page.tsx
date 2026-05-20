import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { RETURN_WINDOW_DAYS, getRemainingReturnableQty } from '@/lib/returns';
import ReturnRequestForm from './ReturnRequestForm';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ id: string; locale: string }>;
};

export default async function NewReturnPage({ params }: Props) {
    const { id, locale } = await params;
    setRequestLocale(locale);

    const session = await auth();
    if (!session?.user?.id) {
        redirect(`/auth/login?callbackUrl=/account/orders/${id}/return`);
    }

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            order_items: { select: { id: true, name: true, sku: true, quantity: true, price: true } }
        }
    });
    if (!order || order.user_id !== session.user.id) notFound();

    // Validaciones de elegibilidad (delivered + ventana).
    const eligible = order.status === 'DELIVERED' && order.payment_status === 'PAID';
    const ageDays = (Date.now() - order.updated_at.getTime()) / 86_400_000;
    const inWindow = ageDays <= RETURN_WINDOW_DAYS;

    // Calcular cuánto queda devolvible por cada item.
    const remainingByItem = await Promise.all(
        order.order_items.map(async (it) => ({
            ...it,
            remaining: await getRemainingReturnableQty(prisma, it.id)
        }))
    );
    const itemsAvailable = remainingByItem.filter((it) => it.remaining > 0);

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
            <Link href="/account/orders" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                ← Volver a mis pedidos
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
                Solicitar devolución
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                Pedido <strong>{order.order_number}</strong>
            </p>

            {!eligible && (
                <div style={{ background: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                    <p>Sólo puedes devolver pedidos entregados y pagados.</p>
                </div>
            )}

            {eligible && !inWindow && (
                <div style={{ background: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                    <p>La ventana de devolución de {RETURN_WINDOW_DAYS} días ha expirado para este pedido.</p>
                </div>
            )}

            {eligible && inWindow && itemsAvailable.length === 0 && (
                <div style={{ background: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                    <p>Ya has devuelto todos los productos de este pedido.</p>
                </div>
            )}

            {eligible && inWindow && itemsAvailable.length > 0 && (
                <ReturnRequestForm
                    orderId={order.id}
                    items={itemsAvailable.map((it) => ({
                        id: it.id,
                        name: it.name,
                        sku: it.sku,
                        max: it.remaining,
                        price: Number(it.price)
                    }))}
                />
            )}
        </div>
    );
}
