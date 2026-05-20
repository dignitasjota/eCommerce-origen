import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronAuth, CronAuthError } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartEmailHtml } from '@/lib/emails/abandoned-cart';
import { auditLogServer } from '@/lib/audit';

/**
 * Cron de recuperación de carritos abandonados.
 *
 * Trigger recomendado: cada hora (o una vez al día).
 *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
 *        https://tienda.cliente.com/api/admin/cron/abandoned-carts
 *
 * Estrategia simple SIN columna nueva (`last_reminder_at` requeriría migración):
 *   - Seleccionamos `cart_items` con `updated_at` en la VENTANA [24h-26h].
 *   - Esa ventana sólo coincide una vez en la vida útil del cart_item, así
 *     que evitamos duplicados sin necesidad de marcar nada.
 *   - Excluimos usuarios que han hecho un Order en las últimas 26h
 *     (asumimos que ya completaron).
 *
 * Si quieres ventana más amplia o múltiples disparos, añade una columna
 * `last_reminder_at` a CartItem o crea tabla `cart_reminder` y filtra.
 */
export const dynamic = 'force-dynamic';

const WINDOW_FROM_H = 26;
const WINDOW_TO_H = 24;
const MAX_BATCH = 200;

export async function POST(req: Request) {
    try {
        verifyCronAuth(req);
    } catch (e) {
        if (e instanceof CronAuthError) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        throw e;
    }

    const now = Date.now();
    const windowStart = new Date(now - WINDOW_FROM_H * 3_600_000);
    const windowEnd = new Date(now - WINDOW_TO_H * 3_600_000);

    // Agrupamos cart_items por user_id dentro de la ventana.
    const items = await prisma.cartItem.findMany({
        where: {
            user_id: { not: null },
            updated_at: { gte: windowStart, lt: windowEnd }
        },
        include: {
            users: { select: { id: true, name: true, email: true } },
            products: {
                select: {
                    slug: true,
                    product_translations: { take: 1, where: { locale: 'es' }, select: { name: true } },
                    product_images: { take: 1, orderBy: { sort_order: 'asc' }, select: { url: true } }
                }
            }
        },
        take: MAX_BATCH
    });

    // Agrupar por user_id.
    const byUser = new Map<
        string,
        {
            email: string;
            name: string | null;
            items: Array<{ name: string; quantity: number; price: number; image: string | null }>;
        }
    >();

    for (const it of items) {
        if (!it.users) continue;
        if (!byUser.has(it.users.id)) {
            byUser.set(it.users.id, { email: it.users.email, name: it.users.name, items: [] });
        }
        const product = it.products;
        // Necesitamos el precio para el email. CartItem no lo guarda; lo
        // releemos del producto (el carrito de DB no tiene precio congelado).
        const price = await prisma.product
            .findUnique({ where: { slug: product?.slug }, select: { price: true } })
            .then((p) => (p ? Number(p.price) : 0));

        byUser.get(it.users.id)!.items.push({
            name: product?.product_translations[0]?.name || product?.slug || 'Producto',
            quantity: it.quantity,
            price,
            image: product?.product_images[0]?.url || null
        });
    }

    // Excluir usuarios que han hecho una orden reciente.
    const userIds = Array.from(byUser.keys());
    if (userIds.length === 0) {
        return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }
    const recentlyOrdered = await prisma.order.findMany({
        where: {
            user_id: { in: userIds },
            created_at: { gte: windowStart }
        },
        select: { user_id: true }
    });
    for (const o of recentlyOrdered) {
        if (o.user_id) byUser.delete(o.user_id);
    }

    // Cargar siteName para personalizar el email.
    const siteSetting = await prisma.siteSetting.findUnique({ where: { key: 'site_name' } });
    const siteName = siteSetting?.value || 'eShop';
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;
    const cartUrl = `${baseUrl}/cart`;

    let sent = 0;
    const failures: Array<{ userId: string; error: string }> = [];

    for (const [userId, payload] of byUser) {
        try {
            await sendEmail({
                to: payload.email,
                subject: `${payload.name || 'Hola'}, te dejaste algo en el carrito de ${siteName}`,
                html: getAbandonedCartEmailHtml(
                    payload.name || 'Cliente',
                    payload.items,
                    cartUrl,
                    siteName
                )
            });
            await auditLogServer({
                action: 'cart.abandonment_reminder',
                entity_type: 'User',
                entity_id: userId,
                metadata: { items: payload.items.length }
            });
            sent++;
        } catch (e: any) {
            failures.push({ userId, error: e?.message || 'unknown' });
            console.error(`[abandoned-carts] email failed for ${userId}:`, e?.message);
        }
    }

    return NextResponse.json({
        ok: true,
        candidates: byUser.size + recentlyOrdered.length,
        sent,
        skipped: recentlyOrdered.length,
        failures
    });
}
