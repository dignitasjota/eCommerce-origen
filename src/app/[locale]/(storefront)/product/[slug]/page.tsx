import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import ProductGallery from '@/components/storefront/ProductGallery';
import AddToCartForm from '@/components/storefront/AddToCartForm';
import WishlistButton from '@/components/storefront/WishlistButton';
import ReviewForm from '@/components/storefront/ReviewForm';
import { sanitizeHtml } from '@/lib/sanitize';
import { pushRecentSlug } from '@/lib/recently-viewed';
import RecentlyViewed from '@/components/storefront/RecentlyViewed';

type Props = {
    params: Promise<{ locale: string; slug: string }>;
};

/**
 * Carga el producto con todos los joins necesarios. Está envuelta en `cache()`
 * de React para que `generateMetadata` y `ProductPage` compartan el mismo
 * resultado dentro de la misma request HTTP — evita un segundo viaje a DB con
 * idénticos parámetros.
 */
const getProduct = cache(async (slug: string, locale: string) => {
    return prisma.product.findUnique({
        where: { slug },
        include: {
            product_translations: { where: { locale } },
            product_images: { orderBy: { sort_order: 'asc' } },
            related_to: {
                include: {
                    related_product: {
                        include: {
                            product_translations: { where: { locale } },
                            product_images: { take: 1, orderBy: { sort_order: 'asc' } }
                        }
                    }
                }
            },
            reviews: {
                where: { is_approved: true },
                include: { users: { select: { name: true } } },
                orderBy: { created_at: 'desc' }
            },
            product_categories: {
                include: {
                    categories: {
                        include: { category_translations: { where: { locale } } }
                    }
                }
            },
            product_variants: {
                where: { is_active: true },
                include: {
                    product_variant_options: {
                        include: {
                            variant_options: {
                                include: {
                                    variant_types: {
                                        include: { variant_type_translations: { where: { locale } } }
                                    },
                                    variant_option_translations: { where: { locale } }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
});

export default async function ProductPage({ params }: Props) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('product');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Carga producto + sesión en paralelo. `getProduct` está cacheado por React
    // a nivel de request, así que `generateMetadata` reutiliza el mismo fetch.
    const [product, session] = await Promise.all([
        getProduct(slug, locale),
        auth()
    ]);

    if (!product || !product.is_active) {
        notFound();
    }

    // Registrar la visita en la cookie "Productos vistos recientemente".
    // No bloquea el render — si la API de cookies es read-only (build-time
    // o edge), el helper falla en silencio.
    await pushRecentSlug(product.slug);

    // Si hay sesión, las tres consultas dependientes del usuario son
    // independientes entre sí: las paralelizamos para ahorrar 2 round-trips.
    let isFavorited = false;
    let canReview = false;
    let hasReviewed = false;

    if (session?.user?.id) {
        const userId = session.user.id;
        const [wishlistItem, userHasPurchased, userReview] = await Promise.all([
            prisma.wishlistItem.findUnique({
                where: { user_id_product_id: { user_id: userId, product_id: product.id } }
            }),
            prisma.order.findFirst({
                where: {
                    user_id: userId,
                    order_items: { some: { product_id: product.id } }
                },
                select: { id: true }
            }),
            prisma.review.findUnique({
                where: { user_id_product_id: { user_id: userId, product_id: product.id } },
                select: { id: true }
            })
        ]);

        isFavorited = !!wishlistItem;
        if (userHasPurchased) {
            hasReviewed = !!userReview;
            canReview = !userReview;
        }
    }

    const tData = product.product_translations[0];
    const name = tData?.name || product.slug;
    const description = tData?.description || tData?.short_description || 'Sin descripción detallada';

    // Primary Category for breadcrumbs
    const primaryCategory = product.product_categories[0]?.categories;
    const catName = primaryCategory?.category_translations[0]?.name || primaryCategory?.slug;

    // Calculate Rating
    const totalReviews = product.reviews.length;
    const averageRating = totalReviews > 0
        ? product.reviews.reduce((acc, rev) => acc + rev.rating, 0) / totalReviews
        : 0;

    // Formatting variants for the client component
    const formattedVariants = product.product_variants.map((variant: any) => ({
        id: variant.id,
        price: variant.price ? Number(variant.price).toFixed(2) : Number(product.price).toFixed(2),
        stock: variant.stock,
        options: variant.product_variant_options.map((pvo: any) => ({
            attributeId: pvo.variant_options.variant_types.id,
            attributeName: pvo.variant_options.variant_types.variant_type_translations[0]?.name || 'Atributo',
            optionId: pvo.variant_options.id,
            optionName: pvo.variant_options.variant_option_translations[0]?.value || pvo.variant_options.slug
        }))
    }));

    // Extracting all available attributes and their options for select dropdowns
    const availableAttributesMap = new Map();
    formattedVariants.forEach((variant: any) => {
        variant.options.forEach((opt: any) => {
            if (!availableAttributesMap.has(opt.attributeId)) {
                availableAttributesMap.set(opt.attributeId, {
                    id: opt.attributeId,
                    name: opt.attributeName,
                    options: new Map()
                });
            }
            availableAttributesMap.get(opt.attributeId).options.set(opt.optionId, opt.optionName);
        });
    });

    const availableAttributes = Array.from(availableAttributesMap.values()).map((attr: any) => ({
        ...attr,
        options: Array.from(attr.options.entries()).map(([id, name]: any) => ({ id, name }))
    }));

    // RENDER STARS HELPER
    const renderStars = (rating: number) => {
        return (
            <div style={{ display: 'flex', gap: '0.1rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                    <svg aria-hidden="true" focusable="false" key={star} width="16" height="16" viewBox="0 0 24 24" fill={rating >= star ? '#FFD700' : 'none'} stroke={rating >= star ? '#FFD700' : 'var(--color-text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                ))}
            </div>
        );
    };

    return (
        <div className="container" style={{ padding: '2rem 1rem 5rem' }}>
            {/* Breadcrumbs */}
            <nav style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</Link>
                <span style={{ margin: '0 0.5rem' }}>/</span>
                <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>Productos</Link>
                {primaryCategory && (
                    <>
                        <span style={{ margin: '0 0.5rem' }}>/</span>
                        <Link href={`/category/${primaryCategory.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {catName}
                        </Link>
                    </>
                )}
                <span style={{ margin: '0 0.5rem' }}>/</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{name}</span>
            </nav>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 400px)', gap: '4rem', alignItems: 'flex-start' }}>
                {/* Left Col: Image Gallery */}
                <ProductGallery images={product.product_images.map(img => img.url)} productName={name} />

                {/* Right Col: Product Info */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', lineHeight: '1.2', margin: 0, paddingRight: '1rem' }}>
                            {name}
                        </h1>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-background-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <WishlistButton
                                productId={product.id}
                                initialIsFavorited={isFavorited}
                            />
                        </div>
                    </div>

                    {/* RATING SNIPPET */}
                    {totalReviews > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                            {renderStars(Math.round(averageRating))}
                            <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>{averageRating.toFixed(1)}</span>
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>({totalReviews} reseñas)</span>
                            <a href="#reviews" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', textDecoration: 'underline', marginLeft: 'auto' }}>Leer reseñas</a>
                        </div>
                    )}

                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '2rem' }}>
                        {Number(product.price).toFixed(2)} €
                    </div>

                    {/* Add to Cart Form */}
                    <AddToCartForm
                        productId={product.id}
                        productName={name}
                        image={product.product_images[0]?.url}
                        basePrice={Number(product.price).toFixed(2)}
                        variants={formattedVariants}
                        attributes={availableAttributes}
                    />

                    {/* Description */}
                    <div style={{ marginTop: '3rem' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                            Descripción
                        </h3>
                        <div
                            style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                        />
                    </div>

                    {/* Extra Info */}
                    <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>
                        <p>SKU: {product.sku}</p>
                    </div>
                </div>
            </div>

            {/* SECCIÓN RESEÑAS */}
            <div id="reviews" style={{ marginTop: '6rem', paddingTop: '3rem', borderTop: '1px solid var(--color-border)' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>Reseñas de Clientes</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 400px)', gap: '4rem', alignItems: 'flex-start' }}>
                    {/* Lista de Reseñas */}
                    <div>
                        {totalReviews === 0 ? (
                            <div style={{ padding: '3rem 2rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Aún no hay reseñas</h3>
                                <p style={{ color: 'var(--color-text-secondary)' }}>Sé el primero en compartir tu opinión sobre este producto.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {product.reviews.map(review => (
                                    <div key={review.id} style={{ padding: '1.5rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div>
                                                {renderStars(review.rating)}
                                                <div style={{ fontWeight: 'bold', marginTop: '0.5rem', fontSize: '1.1rem' }}>{review.title}</div>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                                {new Date(review.created_at).toLocaleDateString()}
                                                <div style={{ marginTop: '0.2rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                                                    Por {review.users.name || 'Cliente Verificado'}
                                                </div>
                                            </div>
                                        </div>
                                        {review.comment && (
                                            <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                                                {review.comment}
                                            </p>
                                        )}
                                        <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: '600' }}>
                                            <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                            Compra verificada
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Formulario / CTA de Reseñas */}
                    <div>
                        {!session ? (
                            <div style={{ padding: '2rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¿Has comprado este producto?</h3>
                                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Inicia sesión para compartir tu experiencia con nosotros.</p>
                                <Link href="/auth/login" className="btn btn-outline" style={{ width: '100%' }}>Iniciar Sesión</Link>
                            </div>
                        ) : canReview ? (
                            <ReviewForm productId={product.id} />
                        ) : hasReviewed ? (
                            <div style={{ padding: '2rem', backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', border: '1px solid currentColor', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¡Reseña enviada!</h3>
                                <p style={{ opacity: 0.9 }}>Ya has compartido tu opinión sobre este producto. ¡Gracias!</p>
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                <div style={{ display: 'inline-block', padding: '1rem', backgroundColor: 'var(--color-background-soft)', borderRadius: '50%', marginBottom: '1rem' }}>
                                    <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                </div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Solo Compradores</h3>
                                <p style={{ color: 'var(--color-text-secondary)' }}>Para garantizar la autenticidad, solo los clientes que han adquirido este artículo pueden publicar reseñas.</p>
                            </div>
                        )}
                    </div>
                </div>
                {/* CROSS-SELLING / UP-SELLING */}
                {(product.related_to.length > 0) && (
                    <div style={{ marginTop: '5rem', paddingTop: '3rem', borderTop: '1px solid var(--color-border)' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>También te puede interesar</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                            {product.related_to.map(relation => {
                                const relProd = relation.related_product;
                                const tTranslation = relProd.product_translations[0];
                                const img = relProd.product_images[0]?.url;
                                return (
                                    <Link
                                        href={`/product/${relProd.slug}`}
                                        key={relation.id}
                                        style={{ display: 'block', textDecoration: 'none', color: 'inherit', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                        className="hover-scale"
                                    >
                                        <div style={{ aspectRatio: '1/1', backgroundColor: 'var(--color-background-soft)', position: 'relative' }}>
                                            {img ? (
                                                <Image
                                                    src={img}
                                                    alt={tTranslation?.name || relProd.slug}
                                                    fill
                                                    sizes="(max-width: 768px) 50vw, 280px"
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>📷</div>
                                            )}
                                            {relation.relation_type === 'UP_SELL' && (
                                                <span style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px' }}>
                                                    Premium
                                                </span>
                                            )}
                                            {relation.relation_type === 'CROSS_SELL' && (
                                                <span style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'var(--color-text-secondary)', color: 'white', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px' }}>
                                                    Sugerencia
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ padding: '1.25rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {tTranslation?.name || relProd.slug}
                                            </h3>
                                            <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                                {Number(relProd.price).toFixed(2)} €
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Vistos recientemente, excluyendo el producto actual. */}
            <RecentlyViewed locale={locale} excludeSlug={product.slug} />

            {/* JSON-LD: Breadcrumb */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            {
                                "@type": "ListItem",
                                position: 1,
                                name: "Inicio",
                                item: locale === 'es' ? `${appUrl}/` : `${appUrl}/${locale}/`
                            },
                            {
                                "@type": "ListItem",
                                position: 2,
                                name: "Productos",
                                item: locale === 'es' ? `${appUrl}/products` : `${appUrl}/${locale}/products`
                            },
                            ...(primaryCategory
                                ? [{
                                      "@type": "ListItem",
                                      position: 3,
                                      name: catName,
                                      item: locale === 'es'
                                          ? `${appUrl}/category/${primaryCategory.slug}`
                                          : `${appUrl}/${locale}/category/${primaryCategory.slug}`
                                  }]
                                : []),
                            {
                                "@type": "ListItem",
                                position: primaryCategory ? 4 : 3,
                                name,
                                item: locale === 'es'
                                    ? `${appUrl}/product/${product.slug}`
                                    : `${appUrl}/${locale}/product/${product.slug}`
                            }
                        ]
                    })
                }}
            />

            {/* JSON-LD Schema de Producto */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org/",
                        "@type": "Product",
                        "name": name,
                        "image": product.product_images.map(img => `${appUrl}${img.url}`),
                        "description": description,
                        "sku": product.sku,
                        "offers": {
                            "@type": "AggregateOffer",
                            "url": `${appUrl}/${locale}/product/${product.slug}`,
                            "priceCurrency": "EUR",
                            "lowPrice": product.price,
                            "highPrice": product.price,
                            "offerCount": product.product_variants.length > 0 ? product.product_variants.length : 1,
                            "availability": product.product_variants.some(v => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
                        },
                        ...(totalReviews > 0 && {
                            "aggregateRating": {
                                "@type": "AggregateRating",
                                "ratingValue": averageRating.toFixed(1),
                                "reviewCount": totalReviews
                            }
                        })
                    })
                }}
            />
        </div>
    );
}

export async function generateMetadata({ params }: Props) {
    const { locale, slug } = await params;

    // `getProduct` está cacheado por React: si la página ya disparó la query,
    // aquí no hay segundo round-trip a DB.
    const [product, settingsList] = await Promise.all([
        getProduct(slug, locale),
        prisma.siteSetting.findMany({
            where: { key: { in: ['site_name', 'seo_twitter_handle'] } }
        })
    ]);

    const settings = settingsList.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    const siteName = settings['site_name'] || 'eShop';

    if (!product) return { title: `Producto no encontrado | ${siteName}` };

    const tData = product.product_translations[0];
    const name = tData?.name || product.slug;
    const desc = tData?.meta_description || tData?.short_description || `Comprar ${name} en ${siteName}`;
    const imgUrl = product.product_images[0]?.url || '/placeholder.png';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const canonicalPath = locale === 'es' ? `/product/${slug}` : `/${locale}/product/${slug}`;

    return {
        title: `${name} | ${siteName}`,
        description: desc,
        openGraph: {
            title: `${name} | ${siteName}`,
            description: desc,
            url: `${appUrl}${canonicalPath}`,
            siteName: siteName,
            images: [
                {
                    url: `${appUrl}${imgUrl}`,
                    width: 800,
                    height: 800,
                    alt: name,
                },
            ],
            type: 'website',
            locale: locale,
        },
        twitter: {
            card: 'summary_large_image',
            title: `${name} | ${siteName}`,
            description: desc,
            siteId: settings['seo_twitter_handle'],
            creator: settings['seo_twitter_handle'],
            images: [`${appUrl}${imgUrl}`],
        },
        alternates: {
            canonical: `${appUrl}${canonicalPath}`,
            languages: {
                es: `${appUrl}/product/${slug}`,
                en: `${appUrl}/en/product/${slug}`,
                'x-default': `${appUrl}/product/${slug}`
            }
        }
    };
}
