import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';

type Props = {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CategoryPage({ params, searchParams }: Props) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const resolvedSearchParams = await searchParams;
    const t = await getTranslations('product');

    // Find the category
    const category = await prisma.category.findUnique({
        where: { slug },
        include: {
            category_translations: { where: { locale } },
            other_categories: { // subcategories
                where: { is_active: true },
                include: { category_translations: { where: { locale } } }
            }
        }
    });

    if (!category || !category.is_active) {
        notFound();
    }

    const categoryName = category.category_translations[0]?.name || category.slug;
    const categoryDescription = category.category_translations[0]?.description;

    const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Fetch products in this category
    const whereClause = {
        is_active: true,
        product_categories: {
            some: {
                category_id: category.id
            }
        }
    };

    const [dbProducts, totalProducts] = await Promise.all([
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
        prisma.product.count({ where: whereClause })
    ]);

    const formattedProducts = dbProducts.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.product_translations[0]?.name || p.slug,
        price: Number(p.price).toFixed(2),
        image: p.product_images[0]?.url || null
    }));

    const totalPages = Math.ceil(totalProducts / limit);

    return (
        <div className="container" style={{ padding: '4rem 1rem' }}>
            {/* Breadcrumbs */}
            <nav style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</Link>
                <span style={{ margin: '0 0.5rem' }}>/</span>
                <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>Productos</Link>
                <span style={{ margin: '0 0.5rem' }}>/</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{categoryName}</span>
            </nav>

            <header style={{ marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{categoryName}</h1>
                {categoryDescription && (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', maxWidth: '800px' }}>
                        {categoryDescription}
                    </p>
                )}
            </header>

            {/* Subcategories (if any) */}
            {category.other_categories.length > 0 && (
                <div style={{ marginBottom: '3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {category.other_categories.map(sub => (
                        <Link
                            key={sub.id}
                            href={`/category/${sub.slug}`}
                            className="btn btn-outline"
                            style={{ borderRadius: 'var(--radius-full)' }}
                        >
                            {sub.category_translations[0]?.name || sub.slug}
                        </Link>
                    ))}
                </div>
            )}

            {formattedProducts.length > 0 ? (
                <div className="product-grid" style={{ marginBottom: '3rem' }}>
                    {formattedProducts.map((product, index) => (
                        <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className={`card product-card animate-fade-in-up stagger-${(index % limit) + 1}`}
                        >
                            <div className="card-image" style={{ aspectRatio: '1 / 1', backgroundColor: 'var(--color-background-soft)' }}>
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
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>No hay productos en esta categoría por el momento.</p>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3rem' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        const url = new URLSearchParams();
                        url.set('page', p.toString());
                        return (
                            <Link
                                key={p}
                                href={`/category/${slug}?${url.toString()}`}
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

export async function generateMetadata({ params }: Props) {
    const { locale, slug } = await params;
    const category = await prisma.category.findUnique({
        where: { slug },
        include: { category_translations: { where: { locale } } }
    });

    if (!category) return { title: 'Categoría no encontrada | eShop' };

    const name = category.category_translations[0]?.name || category.slug;
    const desc = category.category_translations[0]?.meta_description || category.category_translations[0]?.description || `Explora productos en ${name}`;

    return {
        title: `${name} | eShop`,
        description: desc
    };
}
