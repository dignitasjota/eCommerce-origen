import { NextResponse } from 'next/server';
import { getPublicAppUrl } from '@/lib/app-url';
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
 *   - Seleccionamos `cart_items` con `updated_at` en la VENTANA [24h-72h].
 *   - Deduplicamos con el AuditLog `cart.abandonment_reminder` (un aviso
 *     por usuario cada REMINDER_COOLDOWN_DAYS), así una ejecución fallida no
 *     hace que se pierdan recordatorios.
 *   - Excluimos usuarios que han hecho un Order en las últimas 26h
 *     (asumimos que ya completaron).
 *
 * Si quieres ventana más amplia o múltiples disparos, añade una columna
 * `last_reminder_at` a CartItem o crea tabla `cart_reminder` y filtra.
 */
export const dynamic = 'force-dynamic';

// Ventana amplia (24-72 h) + deduplicación por AuditLog: la antigua ventana
// de 2 h (24-26 h) dependía de que TODAS las ejecuciones horarias corrieran;
// si una fallaba o se saltaba, esos carritos nunca recibían el recordatorio.
// Ahora el "estado" es el propio AuditLog `cart.abandonment_reminder` que ya
// se escribía: un usuario con recordatorio en los últimos REMINDER_COOLDOWN_DAYS
// no recibe otro. Sin migración.
const WINDOW_FROM_H = 72;
const WINDOW_TO_H = 24;
const REMINDER_COOLDOWN_DAYS = 7;
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

    // Precios: releer todos los productos distintos en un único findMany en
    // vez de un findUnique por item dentro del bucle (N+1 — hasta MAX_BATCH
    // queries individuales antes de este fix).
    const productSlugs = Array.from(
        new Set(items.map((it) => it.products?.slug).filter((s): s is string => !!s))
    );
    const products = productSlugs.length
        ? await prisma.product.findMany({
              where: { slug: { in: productSlugs } },
              select: { slug: true, price: true }
          })
        : [];
    const priceBySlug = new Map(products.map((p) => [p.slug, Number(p.price)]));

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
        const price = product?.slug ? (priceBySlug.get(product.slug) ?? 0) : 0;

        byUser.get(it.users.id)!.items.push({
            name: product?.product_translations[0]?.name || product?.slug || 'Producto',
            quantity: it.quantity,
            price,
            image: product?.product_images[0]?.url || null
        });
    }

    // Total de candidatos ANTES de excluir por orden reciente — se usa abajo
    // para reportar `candidates`/`skipped` correctamente (antes, `candidates`
    // se calculaba después de borrar de `byUser`, y `skipped` contaba filas
    // de `recentlyOrdered` en vez de usuarios únicos excluidos).
    const totalCandidates = byUser.size;

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

    const alreadyReminded = await prisma.auditLog.findMany({
        where: {
            action: 'cart.abandonment_reminder',
            entity_type: 'User',
            entity_id: { in: Array.from(byUser.keys()) },
            created_at: { gte: new Date(now - REMINDER_COOLDOWN_DAYS * 86_400_000) }
        },
        select: { entity_id: true }
    });
    for (const r of alreadyReminded) {
        if (r.entity_id) byUser.delete(r.entity_id);
    }

    // Cargar siteName para personalizar el email.
    const siteSetting = await prisma.siteSetting.findUnique({ where: { key: 'site_name' } });
    const siteName = siteSetting?.value || 'eShop';
    const baseUrl =
        getPublicAppUrl(req);
    const cartUrl = `${baseUrl}/cart`;

    let sent = 0;
    const failures: Array<{ userId: string; error: string }> = [];

    for (const [userId, payload] of byUser) {
        try {
            // sendEmail nunca lanza: devuelve success=false. Sólo registramos
            // el recordatorio (que deduplica envíos futuros) si salió de verdad.
            const result = await sendEmail({
                to: payload.email,
                subject: `${payload.name || 'Hola'}, te dejaste algo en el carrito de ${siteName}`,
                html: getAbandonedCartEmailHtml(
                    payload.name || 'Cliente',
                    payload.items,
                    cartUrl,
                    siteName
                )
            });
            if (!result.success) throw new Error(result.error || 'email no enviado');
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
        candidates: totalCandidates,
        sent,
        skipped: totalCandidates - byUser.size,
        failures
    });
}
