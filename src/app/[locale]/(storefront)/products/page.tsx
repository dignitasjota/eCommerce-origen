import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import WishlistButton from '@/components/storefront/WishlistButton';
import styles from './page.module.css'; // We'll create this or reuse globals

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProductsPage({ params, searchParams }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const resolvedSearchParams = await searchParams;
    const t = await getTranslations('product');
    const tNav = await getTranslations('nav');

    const session = await auth();

    const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Search query
    const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q : undefined;

    // Build where clause
    const whereClause: any = { is_active: true };
    if (q) {
        whereClause.product_translations = {
            some: {
                locale,
                name: { contains: q }
            }
        };
    }

    // Fetch products and user's wishlist in parallel
    const [dbProducts, totalProducts, userWishlist] = await Promise.all([
        prisma.product.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { created_at: 'desc' },
            include: {
                product_translations: { where: { locale } },
                product_images: { take: 1, orderBy: { sort_order: 'asc' } }
            }
        }),
        prisma.product.count({ where: whereClause }),
        session?.user?.id
            ? prisma.wishlistItem.findMany({ where: { user_id: session.user.id } })
            : Promise.resolve([])
    ]);

    const wishlistedProductIds = new Set(userWishlist.map(item => item.product_id));

    const formattedProducts = dbProducts.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.product_translations[0]?.name || p.slug,
        price: Number(p.price).toFixed(2),
        image: p.product_images[0]?.url || null,
        isFavorited: wishlistedProductIds.has(p.id)
    }));

    const totalPages = Math.ceil(totalProducts / limit);

    return (
        <div className="container" style={{ padding: '4rem 1rem' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                    {q ? `Resultados para "${q}"` : 'Catálogo de Productos'}
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                    {totalProducts} productos encontrados
                </p>
            </header>

            {formattedProducts.length > 0 ? (
                <div className="product-grid" style={{ marginBottom: '3rem' }}>
                    {formattedProducts.map((product, index) => (
                        <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className={`card product-card animate-fade-in-up stagger-${(index % limit) + 1}`}
                        >
                            <div className="card-image" style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: 'var(--color-background-soft)' }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                                    <WishlistButton
                                        productId={product.id}
                                        initialIsFavorited={product.isFavorited}
                                    />
                                </div>
                                {product.image ? (
                                    <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                            <circle cx="9" cy="9" r="2" />
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="card-body">
                                <h3 className="card-title">{product.name}</h3>
                                <div style={{ marginTop: '0.5rem', fontWeight: '600', color: 'var(--color-primary)' }}>
                                    <span className="card-price">{product.price} €</span>
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                    {t('addToCart')}
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <h2>No se encontraron productos</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem' }}>Sigue buscando o revisa otras categorías.</p>
                    <Link href="/products" className="btn btn-primary" style={{ marginTop: '2rem' }}>Ver todos los productos</Link>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3rem' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        const url = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                        url.set('page', p.toString());
                        if (q) url.set('q', q);
                        return (
                            <Link
                                key={p}
                                href={`/products?${url.toString()}`}
                                className={`btn ${page === p ? 'btn-primary' : 'btn-outline'}`}
                            >
                                {p}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export async function generateMetadata({ params, searchParams }: Props) {
    const { locale } = await params;
    const resolvedSearchParams = await searchParams;
    const q = resolvedSearchParams.q;

    return {
        title: q
            ? `Buscar: ${q} | eShop`
            : locale === 'es' ? 'Catálogo de Productos | eShop' : 'Product Catalog | eShop',
        description: 'Explora nuestra colección completa de productos.'
    };
}
