import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import prisma from '@/lib/db';
import { getRecentSlugs } from '@/lib/recently-viewed';

interface RecentlyViewedProps {
    locale: string;
    /** Slug del producto que se está viendo (se excluye del listado). */
    excludeSlug?: string;
    title?: string;
    /** Máximo de productos a mostrar. */
    limit?: number;
}

/**
 * Server Component que muestra los últimos productos visitados por el usuario.
 * Lee la cookie en el servidor y consulta los productos correspondientes con
 * un único `findMany`. Si no hay coincidencias devuelve `null` (no se renderiza
 * la sección, evitando el "ruido" de un h2 vacío).
 */
export default async function RecentlyViewed({
    locale,
    excludeSlug,
    title = 'Vistos recientemente',
    limit = 8
}: RecentlyViewedProps) {
    const slugs = (await getRecentSlugs()).filter((s) => s !== excludeSlug).slice(0, limit);
    if (slugs.length === 0) return null;

    const products = await prisma.product.findMany({
        where: { slug: { in: slugs }, is_active: true },
        include: {
            product_translations: { where: { locale } },
            product_images: { take: 1, orderBy: { sort_order: 'asc' } }
        }
    });

    // Mantener el orden de la cookie (más reciente primero).
    const order = new Map(slugs.map((s, i) => [s, i]));
    products.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));

    if (products.length === 0) return null;

    return (
        <section style={{ padding: '3rem 0' }}>
            <div className="container">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>{title}</h2>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '1rem'
                    }}
                >
                    {products.map((p) => {
                        const name = p.product_translations[0]?.name || p.slug;
                        const image = p.product_images[0]?.url || null;
                        return (
                            <Link
                                key={p.id}
                                href={`/product/${p.slug}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1 / 1',
                                        backgroundColor: 'var(--color-background-soft)',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                        marginBottom: '0.5rem'
                                    }}
                                >
                                    {image && (
                                        <Image
                                            src={image}
                                            alt={name}
                                            fill
                                            sizes="(max-width: 768px) 50vw, 200px"
                                            style={{ objectFit: 'cover' }}
                                        />
                                    )}
                                </div>
                                <div style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {name}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                    {Number(p.price).toFixed(2)} €
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
