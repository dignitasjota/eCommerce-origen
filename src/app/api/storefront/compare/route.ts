import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { MAX_COMPARE_ITEMS } from '@/lib/compare';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Devuelve las fichas de especificaciones para hasta MAX_COMPARE_ITEMS
 * productos, usados por /compare. La lista de ids viaja en localStorage del
 * cliente (nada que persistir en servidor) — este endpoint sólo rehidrata
 * los datos completos a partir de esos ids.
 *
 * GET /api/storefront/compare?ids=uuid1,uuid2&locale=es
 */
export async function GET(req: Request) {
    const limit = rateLimit(req, { bucket: 'compare', max: 30, windowMs: 60_000 });
    if (!limit.ok) {
        return NextResponse.json(
            { error: 'Demasiadas peticiones. Inténtalo en unos segundos.', products: [] },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const locale = searchParams.get('locale') === 'en' ? 'en' : 'es';
    const ids = (searchParams.get('ids') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
        .slice(0, MAX_COMPARE_ITEMS);

    if (ids.length === 0) {
        return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
        where: { id: { in: ids }, is_active: true },
        include: {
            product_translations: { where: { locale } },
            product_images: { take: 1, orderBy: { sort_order: 'asc' } },
            product_categories: {
                include: { categories: { include: { category_translations: { where: { locale } } } } }
            },
            product_variants: { where: { is_active: true }, select: { stock: true } },
            reviews: { where: { is_approved: true }, select: { rating: true } }
        }
    });

    const formatted = products.map((p) => {
        const totalStock = p.product_variants.reduce((acc, v) => acc + v.stock, 0);
        const availability = p.unlimited_stock || totalStock > 0 ? 'En stock' : 'Agotado';
        const avgRating = p.reviews.length > 0 ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length : null;

        return {
            id: p.id,
            slug: p.slug,
            name: p.product_translations[0]?.name || p.slug,
            description: p.product_translations[0]?.short_description || null,
            image: p.product_images[0]?.url || null,
            price: Number(p.price).toFixed(2),
            compareAtPrice: p.compare_at_price ? Number(p.compare_at_price).toFixed(2) : null,
            sku: p.sku,
            weight: p.weight ? Number(p.weight) : null,
            dimensions: p.dimensions,
            categories: p.product_categories.map((pc) => pc.categories.category_translations[0]?.name || pc.categories.slug).join(', ') || null,
            availability,
            avgRating,
            reviewCount: p.reviews.length
        };
    });

    // Devolver en el mismo orden en que se pidieron (findMany no lo garantiza).
    const byId = new Map(formatted.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

    return NextResponse.json({ products: ordered });
}
