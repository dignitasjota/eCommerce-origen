import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Endpoint de autocompletado para el buscador del header.
 * Devuelve hasta 8 productos coincidentes por nombre traducido al `locale`.
 *
 * GET /api/storefront/search?q=foo&locale=es
 *
 * Si la query es muy corta (<2 chars) devolvemos 200 con array vacío para
 * que el cliente no tenga que validar antes de llamar.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const limit = rateLimit(req, { bucket: 'search', max: 60, windowMs: 60_000 });
    if (!limit.ok) {
        return NextResponse.json(
            { error: 'Demasiadas búsquedas. Inténtalo en unos segundos.', results: [] },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const locale = searchParams.get('locale') === 'en' ? 'en' : 'es';

    if (q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const products = await prisma.product.findMany({
        where: {
            is_active: true,
            product_translations: {
                some: { locale, name: { contains: q } }
            }
        },
        take: 8,
        orderBy: [{ is_featured: 'desc' }, { created_at: 'desc' }],
        include: {
            product_translations: { where: { locale }, select: { name: true } },
            product_images: { take: 1, orderBy: { sort_order: 'asc' }, select: { url: true } }
        }
    });

    const results = products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.product_translations[0]?.name || p.slug,
        price: Number(p.price).toFixed(2),
        image: p.product_images[0]?.url || null
    }));

    return NextResponse.json({ results });
}
