import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import styles from './page.module.css';

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);

    return <HomePageContent locale={locale} />;
}

import prisma from '@/lib/db';

async function HomePageContent({ locale }: { locale: string }) {
    const t = await getTranslations('home');
    const tProduct = await getTranslations('product');
    const tNav = await getTranslations('nav');

    // Fetch from database
    const dbCategories = await prisma.category.findMany({
        where: { is_active: true, parent_id: null },
        orderBy: { sort_order: 'asc' },
        take: 4,
        include: { category_translations: { where: { locale } } }
    });

    const dbFeaturedProducts = await prisma.product.findMany({
        where: { is_active: true, is_featured: true },
        take: 8,
        include: {
            product_translations: { where: { locale } },
            product_images: { take: 1, orderBy: { sort_order: 'asc' } }
        }
    });

    const categories = dbCategories.map(c => ({
        id: c.id,
        slug: c.slug,
        name: c.category_translations[0]?.name || c.slug,
        image: c.image
    }));

    const featuredProducts = dbFeaturedProducts.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.product_translations[0]?.name || p.slug,
        price: Number(p.price).toFixed(2),
        image: p.product_images[0]?.url || null
    }));

    return (
        <div className={styles.page}>
            {/* Hero Section */}
            <section className={`hero-section ${styles.hero}`}>
                <div className={styles.heroOverlay} />
                <div className={`container ${styles.heroContent}`}>
                    <span className={styles.heroBadge}>✨ {t('newArrivals')}</span>
                    <h1 className={styles.heroTitle}>{t('heroTitle')}</h1>
                    <p className={styles.heroSubtitle}>{t('heroSubtitle')}</p>
                    <div className={styles.heroActions}>
                        <Link href="/products" className="btn btn-primary btn-lg">
                            {t('heroButton')}
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className={styles.heroDecor1} />
                <div className={styles.heroDecor2} />
            </section>

            {/* Categories Section */}
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>{t('categoriesTitle')}</h2>
                        <Link href="/categories" className={styles.sectionLink}>
                            {tNav('categories')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Link>
                    </div>
                    <div className="category-grid">
                        {categories.map((category, index) => (
                            <Link
                                key={category.id}
                                href={`/category/${category.slug}`}
                                className={`${styles.categoryCard} animate-fade-in-up stagger-${index + 1}`}
                            >
                                <div className={styles.categoryImage}>
                                    {category.image ? (
                                        <img src={category.image} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div className={styles.categoryPlaceholder}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                                <circle cx="9" cy="9" r="2" />
                                                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <span className={styles.categoryName}>{category.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Products */}
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>{t('featuredTitle')}</h2>
                        <Link href="/products" className={styles.sectionLink}>
                            {t('heroButton')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Link>
                    </div>
                    {featuredProducts.length > 0 ? (
                        <div className="product-grid">
                            {featuredProducts.map((product, index) => (
                                <Link
                                    key={product.id}
                                    href={`/product/${product.slug}`}
                                    className={`card product-card animate-fade-in-up stagger-${index + 1}`}
                                >
                                    <div className="card-image">
                                        {product.image ? (
                                            <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div className={styles.productPlaceholder}>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.2">
                                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                                    <circle cx="9" cy="9" r="2" />
                                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-body">
                                        <h3 className="card-title">{product.name}</h3>
                                        <div className={styles.productPricing}>
                                            <span className="card-price">{product.price} €</span>
                                        </div>
                                        <button className={`btn btn-primary ${styles.addToCartBtn}`}>
                                            {tProduct('addToCart')}
                                        </button>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
                            <p>No hay productos destacados por el momento.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Newsletter / CTA Section */}
            <section className={styles.ctaSection}>
                <div className="container">
                    <div className={styles.ctaContent}>
                        <h2 className={styles.ctaTitle}>Únete a nuestra comunidad</h2>
                        <p className={styles.ctaSubtitle}>Recibe las últimas novedades y ofertas exclusivas</p>
                        <form className={styles.ctaForm}>
                            <input
                                type="email"
                                placeholder="tu@email.com"
                                className={styles.ctaInput}
                            />
                            <button type="button" className="btn btn-primary btn-lg">
                                Suscribirse
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}

export async function generateMetadata({ params }: Props) {
    const { locale } = await params;

    return {
        title: locale === 'es' ? 'eShop — Tu tienda online' : 'eShop — Your online store',
        description:
            locale === 'es'
                ? 'Descubre los mejores productos seleccionados para ti. Envío rápido y seguro.'
                : 'Discover the best products hand-picked for you. Fast and secure shipping.',
    };
}
