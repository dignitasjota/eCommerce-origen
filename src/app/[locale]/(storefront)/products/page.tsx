import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import WishlistButton from '@/components/storefront/WishlistButton';
import AddToCartClientButton from '@/components/storefront/AddToCartClientButton';
import ProductFilters, { type SortKey } from '@/components/storefront/ProductFilters';
import styles from './page.module.css'; // We'll create this or reuse globals

const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'featured'] as const;

function asNonNegativeFloat(value: string | string[] | undefined): string | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return value;
}

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

    const pageRaw = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // ── Parámetros de búsqueda y filtrado ─────────────────────────────────
    const q = typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.trim() : undefined;
    const minPrice = asNonNegativeFloat(resolvedSearchParams.minPrice);
    const maxPrice = asNonNegativeFloat(resolvedSearchParams.maxPrice);
    const categorySlug = typeof resolvedSearchParams.category === 'string' ? resolvedSearchParams.category : undefined;
    const sortRaw = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : 'newest';
    const sort: SortKey = (VALID_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as SortKey) : 'newest';

    const whereClause: Prisma.ProductWhereInput = { is_active: true };

    if (q) {
        whereClause.product_translations = {
            some: { locale, name: { contains: q } }
        };
    }
    if (categorySlug) {
        whereClause.product_categories = {
            some: { categories: { slug: categorySlug } }
        };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
        whereClause.price = {};
        if (minPrice !== undefined) (whereClause.price as Prisma.DecimalFilter).gte = minPrice;
        if (maxPrice !== undefined) (whereClause.price as Prisma.DecimalFilter).lte = maxPrice;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] =
        sort === 'price-asc' ? { price: 'asc' } :
        sort === 'price-desc' ? { price: 'desc' } :
        sort === 'featured' ? [{ is_featured: 'desc' }, { created_at: 'desc' }] :
        { created_at: 'desc' };

    // ── Fetch en paralelo ─────────────────────────────────────────────────
    const [dbProducts, totalProducts, userWishlist, dbCategories] = await Promise.all([
        prisma.product.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy,
            include: {
                product_translations: { where: { locale } },
                product_images: { take: 1, orderBy: { sort_order: 'asc' } }
            }
        }),
        prisma.product.count({ where: whereClause }),
        session?.user?.id
            ? prisma.wishlistItem.findMany({ where: { user_id: session.user.id } })
            : Promise.resolve([]),
        prisma.category.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            select: {
                slug: true,
                category_translations: { where: { locale }, select: { name: true } }
            }
        })
    ]);

    const categories = dbCategories.map((c) => ({
        slug: c.slug,
        name: c.category_translations[0]?.name || c.slug
    }));

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

            <ProductFilters
                sort={sort}
                minPrice={minPrice}
                maxPrice={maxPrice}
                selectedCategory={categorySlug}
                categories={categories}
                preserve={{ q }}
            />

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
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        style={{ objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                        <svg aria-hidden="true" focusable="false" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
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
                                <AddToCartClientButton product={{ id: product.id, name: product.name, price: product.price, image: product.image || undefined }} />
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

            {/* Pagination Controls — preserva todos los searchParams. */}
            {totalPages > 1 && (
                <nav aria-label="Paginación" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        const url = new URLSearchParams();
                        if (q) url.set('q', q);
                        if (sort !== 'newest') url.set('sort', sort);
                        if (minPrice) url.set('minPrice', minPrice);
                        if (maxPrice) url.set('maxPrice', maxPrice);
                        if (categorySlug) url.set('category', categorySlug);
                        url.set('page', p.toString());
                        return (
                            <Link
                                key={p}
                                href={`/products?${url.toString()}`}
                                className={`btn ${page === p ? 'btn-primary' : 'btn-outline'}`}
                                aria-current={page === p ? 'page' : undefined}
                            >
                                {p}
                            </Link>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}

export async function generateMetadata({ params, searchParams }: Props) {
    const { locale } = await params;
    const resolvedSearchParams = await searchParams;
    const q = resolvedSearchParams.q;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const canonicalPath = locale === 'es' ? '/products' : `/${locale}/products`;

    return {
        title: q
            ? `Buscar: ${q} | eShop`
            : locale === 'es' ? 'Catálogo de Productos | eShop' : 'Product Catalog | eShop',
        description: 'Explora nuestra colección completa de productos.',
        // Si hay query de búsqueda, no es indexable: la URL canonical apunta
        // siempre a /products sin filtros para concentrar señal SEO.
        robots: q ? { index: false, follow: true } : undefined,
        alternates: appUrl
            ? {
                  canonical: `${appUrl}${canonicalPath}`,
                  languages: {
                      es: `${appUrl}/products`,
                      en: `${appUrl}/en/products`,
                      'x-default': `${appUrl}/products`
                  }
              }
            : undefined
    };
}
