import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import AddToCartClientButton from '@/components/storefront/AddToCartClientButton';
import ProductFilters, { type SortKey } from '@/components/storefront/ProductFilters';

const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'featured'] as const;
function asNonNegativeFloat(v: string | string[] | undefined): string | undefined {
    if (typeof v !== 'string' || !v.trim()) return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? v : undefined;
}

type Props = {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CategoryPage({ params, searchParams }: Props) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const resolvedSearchParams = await searchParams;
    const t = await getTranslations('product');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

    const pageRaw = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Filtros (sin el de categoría: la categoría la fija el path).
    const minPrice = asNonNegativeFloat(resolvedSearchParams.minPrice);
    const maxPrice = asNonNegativeFloat(resolvedSearchParams.maxPrice);
    const sortRaw = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : 'newest';
    const sort: SortKey = (VALID_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as SortKey) : 'newest';

    const whereClause: Prisma.ProductWhereInput = {
        is_active: true,
        product_categories: { some: { category_id: category.id } }
    };
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

    const [dbProducts, totalProducts] = await Promise.all([
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

            <ProductFilters
                sort={sort}
                minPrice={minPrice}
                maxPrice={maxPrice}
                hideCategory
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
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>No hay productos en esta categoría por el momento.</p>
                </div>
            )}

            {/* Pagination Controls — preserva sort y precio. */}
            {totalPages > 1 && (
                <nav aria-label="Paginación" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        const url = new URLSearchParams();
                        if (sort !== 'newest') url.set('sort', sort);
                        if (minPrice) url.set('minPrice', minPrice);
                        if (maxPrice) url.set('maxPrice', maxPrice);
                        url.set('page', p.toString());
                        return (
                            <Link
                                key={p}
                                href={`/category/${slug}?${url.toString()}`}
                                className={`btn ${page === p ? 'btn-primary' : 'btn-outline'}`}
                                aria-current={page === p ? 'page' : undefined}
                            >
                                {p}
                            </Link>
                        );
                    })}
                </nav>
            )}

            {/* JSON-LD Schema de Migas de Pan */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {
                                "@type": "ListItem",
                                "position": 1,
                                "name": "Inicio",
                                "item": `${appUrl}/${locale}`
                            },
                            {
                                "@type": "ListItem",
                                "position": 2,
                                "name": "Productos",
                                "item": `${appUrl}/${locale}/products`
                            },
                            {
                                "@type": "ListItem",
                                "position": 3,
                                "name": categoryName,
                                "item": `${appUrl}/${locale}/category/${category.slug}`
                            }
                        ]
                    })
                }}
            />
        </div>
    );
}

export async function generateMetadata({ params }: Props) {
    const { locale, slug } = await params;

    // Obtenemos la categoría local y opciones SEO globales en paralelo
    const [category, settingsList] = await Promise.all([
        prisma.category.findUnique({
            where: { slug },
            include: { category_translations: { where: { locale } } }
        }),
        prisma.siteSetting.findMany({
            where: { key: { in: ['site_name', 'seo_twitter_handle'] } }
        })
    ]);

    const settings = settingsList.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    const siteName = settings['site_name'] || 'eShop';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!category) return { title: `Categoría no encontrada | ${siteName}` };

    const name = category.category_translations[0]?.name || category.slug;
    const desc = category.category_translations[0]?.meta_description || category.category_translations[0]?.description || `Explora todos los productos de la categoría ${name} en ${siteName}`;
    const canonicalPath = locale === 'es' ? `/category/${category.slug}` : `/${locale}/category/${category.slug}`;
    const ogImage = category.image ? `${appUrl}${category.image}` : undefined;

    return {
        title: `${name} | ${siteName}`,
        description: desc,
        openGraph: {
            title: `${name} | ${siteName}`,
            description: desc,
            url: `${appUrl}${canonicalPath}`,
            siteName: siteName,
            type: 'website',
            locale: locale,
            images: ogImage ? [{ url: ogImage, alt: name }] : undefined,
        },
        twitter: {
            card: ogImage ? 'summary_large_image' : 'summary',
            title: `${name} | ${siteName}`,
            description: desc,
            siteId: settings['seo_twitter_handle'],
            creator: settings['seo_twitter_handle'],
            images: ogImage ? [ogImage] : undefined,
        },
        alternates: {
            canonical: `${appUrl}${canonicalPath}`,
            languages: {
                es: `${appUrl}/category/${category.slug}`,
                en: `${appUrl}/en/category/${category.slug}`,
                'x-default': `${appUrl}/category/${category.slug}`
            }
        }
    };
}
