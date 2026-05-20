import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

interface ClientItem {
    product_id: string;
    variant_id?: string | null;
    quantity: number;
    name?: string;
    price?: number;
    image?: string;
    attributes?: Record<string, string>;
}

/**
 * Fusiona el carrito anónimo (localStorage) del cliente con el carrito en DB
 * del usuario al iniciar sesión. Estrategia:
 *
 *   - Para cada par (product_id, variant_id) presente en ambos lados,
 *     sumamos cantidades. Más permisivo que "el último gana" porque favorece
 *     al usuario (no se pierden productos que añadió siendo anónimo).
 *   - Validamos que cada product_id existe y está activo. Los inválidos se
 *     descartan silenciosamente — no abortamos la fusión por un item caducado.
 *   - Releemos `name`, `price`, `image` desde DB (nunca confiamos en el cliente).
 *   - Devolvemos la lista resultante en el formato que entiende el reducer del
 *     CartContext, para que el cliente sustituya su localStorage.
 *
 * Idempotente: re-llamarlo con los mismos items no duplica cantidades porque
 * el merge se hace contra el estado actual de DB, no contra el incoming.
 * Pero el cliente debe llamarlo SOLO una vez por sesión (al transitar de
 * anónimo a logueado), no en cada navegación.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }
    const userId = session.user.id;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const incoming: ClientItem[] = Array.isArray(body?.items) ? body.items : [];
    if (incoming.length > 100) {
        return NextResponse.json({ error: 'Demasiados items.' }, { status: 400 });
    }

    // Carga el estado actual del carrito en DB para fusión.
    const existing = await prisma.cartItem.findMany({
        where: { user_id: userId },
        select: { id: true, product_id: true, variant_id: true, quantity: true }
    });

    // Mapa de cantidades por (product_id|variant_id) que queremos al final.
    type Key = string;
    const targetQty = new Map<Key, { product_id: string; variant_id: string | null; quantity: number }>();
    const keyOf = (pid: string, vid: string | null) => `${pid}|${vid ?? ''}`;

    for (const it of existing) {
        targetQty.set(keyOf(it.product_id, it.variant_id), {
            product_id: it.product_id,
            variant_id: it.variant_id,
            quantity: it.quantity
        });
    }

    for (const it of incoming) {
        if (!it || typeof it.product_id !== 'string') continue;
        const qty = Number.isInteger(it.quantity) && it.quantity > 0 ? Math.min(it.quantity, 99) : 0;
        if (qty === 0) continue;
        const variant_id = typeof it.variant_id === 'string' ? it.variant_id : null;
        const k = keyOf(it.product_id, variant_id);
        const prev = targetQty.get(k);
        targetQty.set(k, {
            product_id: it.product_id,
            variant_id,
            quantity: Math.min((prev?.quantity || 0) + qty, 99)
        });
    }

    if (targetQty.size === 0) {
        return NextResponse.json({ items: [] });
    }

    // Validar que los productos existen y están activos. Los inválidos se descartan.
    const productIds = Array.from(new Set([...targetQty.values()].map((v) => v.product_id)));
    const validProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, is_active: true },
        include: {
            product_translations: { take: 1 },
            product_images: { take: 1, orderBy: { sort_order: 'asc' } }
        }
    });
    const productById = new Map(validProducts.map((p) => [p.id, p]));

    const targets = Array.from(targetQty.values()).filter((t) => productById.has(t.product_id));

    // Sincronizar DB: borrar lo no presente en `targets` y upsert por (user, product, variant).
    await prisma.$transaction(async (tx) => {
        await tx.cartItem.deleteMany({ where: { user_id: userId } });
        if (targets.length > 0) {
            await tx.cartItem.createMany({
                data: targets.map((t) => ({
                    user_id: userId,
                    product_id: t.product_id,
                    variant_id: t.variant_id,
                    quantity: t.quantity
                }))
            });
        }
    });

    // Construir respuesta enriquecida con name/price/image desde DB.
    const items = targets.map((t) => {
        const p = productById.get(t.product_id)!;
        return {
            id: t.variant_id ? `${t.product_id}_${t.variant_id}` : t.product_id,
            product_id: t.product_id,
            variant_id: t.variant_id ?? undefined,
            name: p.product_translations[0]?.name || p.slug,
            price: Number(p.price),
            image: p.product_images[0]?.url || undefined,
            quantity: t.quantity
        };
    });

    return NextResponse.json({ items });
}
