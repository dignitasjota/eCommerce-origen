import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Metadata } from 'next';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ locale: string; dynamicSlug: string[] }> | { locale: string; dynamicSlug: string[] };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const resolvedParams = await params;
    const { dynamicSlug } = resolvedParams;
    const locale = await getLocale();

    // Comprobar si es legal (1 segmento)
    if (dynamicSlug.length === 1) {
        const slug = dynamicSlug[0];
        const legalPage = await prisma.legalPage.findUnique({
            where: { slug },
            include: { legal_page_translations: true }
        });
        if (legalPage && legalPage.legal_page_translations.length > 0) {
            const translation = legalPage.legal_page_translations.find(t => t.locale === locale)
                || legalPage.legal_page_translations.find(t => t.locale === 'es')
                || legalPage.legal_page_translations[0];

            return {
                title: translation.title,
                description: `Información legal sobre ${translation.title}`,
            };
        }
    }

    // Comprobar si es Page
    const prefixSetting = await prisma.siteSetting.findUnique({
        where: { key: 'pages_prefix' }
    });
    const prefix = (prefixSetting?.value && prefixSetting.value.trim() !== '' && prefixSetting.value !== 'null') ? prefixSetting.value.trim() : '';

    let pageSlug: string | null = null;
    if (prefix === '' && dynamicSlug.length === 1) {
        pageSlug = dynamicSlug[0];
    } else if (prefix !== '' && dynamicSlug.length === 2 && dynamicSlug[0] === prefix) {
        pageSlug = dynamicSlug[1];
    }

    if (pageSlug) {
        const page = await prisma.page.findUnique({
            where: { slug: pageSlug },
            include: { page_translations: true }
        });
        if (page && page.page_translations.length > 0) {
            const translation = page.page_translations.find(t => t.locale === locale)
                || page.page_translations.find(t => t.locale === 'es')
                || page.page_translations[0];

            return {
                title: translation.title,
                description: translation.title,
            };
        }
    }

    return { title: 'Not Found' };
}

async function CategoryBlock({ categorySlug, locale }: { categorySlug: string; locale: string }) {
    const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
        include: { category_translations: { where: { locale } } }
    });

    if (!category) return null;

    const products = await prisma.product.findMany({
        where: {
            is_active: true,
            product_categories: { some: { category_id: category.id } }
        },
        take: 8,
        orderBy: { created_at: 'desc' },
        include: {
            product_translations: { where: { locale } },
            product_images: { take: 1, orderBy: { sort_order: 'asc' } }
        }
    });

    if (products.length === 0) return null;

    return (
        <div className="not-prose my-12" style={{ fontFamily: 'inherit' }}>
            <h3 className="text-2xl font-bold mb-8 text-[var(--color-text)] border-b pb-2 inline-block border-[var(--color-primary)]">
                {category.category_translations[0]?.name || category.slug}
            </h3>
            <div className="product-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '2rem'
            }}>
                {products.map((p, index) => {
                    const name = p.product_translations[0]?.name || p.slug;
                    const image = p.product_images[0]?.url || null;
                    return (
                        <a
                            key={p.id}
                            href={locale === 'es' ? `/product/${p.slug}` : `/${locale}/product/${p.slug}`}
                            className={`card product-card animate-fade-in-up stagger-${(index % 12) + 1}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                        >
                            <figure className="aspect-[4/5] overflow-hidden bg-[var(--color-background)] relative group">
                                {image ? (
                                    <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', color: '#999' }}>
                                        Sin imagen
                                    </div>
                                )}
                            </figure>
                            <div className="card-body p-5">
                                <h4 className="card-title text-lg m-0" style={{ textDecoration: 'none' }}>{name}</h4>
                                <div className="mt-2 text-lg font-bold text-[var(--color-primary)]">
                                    <span className="card-price">{Number(p.price).toFixed(2)} €</span>
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}

export default async function DynamicPageView({ params }: Props) {
    const resolvedParams = await params;
    const { dynamicSlug } = resolvedParams;
    const locale = await getLocale();

    // Renderizado Legal (1 segmento)
    if (dynamicSlug.length === 1) {
        const slug = dynamicSlug[0];
        const legalPage = await prisma.legalPage.findUnique({
            where: { slug },
            include: { legal_page_translations: true }
        });
        if (legalPage && legalPage.legal_page_translations.length > 0) {
            const translation = legalPage.legal_page_translations.find(t => t.locale === locale)
                || legalPage.legal_page_translations.find(t => t.locale === 'es')
                || legalPage.legal_page_translations[0];

            const { title, content } = translation;
            return (
                <div className="container py-12 md:py-16">
                    <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                        <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{title}</h1>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Última actualización: {new Date(legalPage.updated_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                })}
                            </p>
                        </header>
                        <div
                            className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-primary)] hover:prose-a:text-[var(--color-primary-dark)] text-[var(--color-text-secondary)]"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    </div>
                </div>
            );
        }
    }

    // Renderizado Page Normal
    const prefixSetting = await prisma.siteSetting.findUnique({
        where: { key: 'pages_prefix' }
    });
    const prefix = (prefixSetting?.value && prefixSetting.value.trim() !== '' && prefixSetting.value !== 'null') ? prefixSetting.value.trim() : '';

    let pageSlug: string | null = null;
    if (prefix === '' && dynamicSlug.length === 1) {
        // En root: /[slug]
        pageSlug = dynamicSlug[0];
    } else if (prefix !== '' && dynamicSlug.length === 2 && dynamicSlug[0] === prefix) {
        // En /[prefix]/[slug]
        pageSlug = dynamicSlug[1];
    }

    if (pageSlug) {
        const page = await prisma.page.findUnique({
            where: { slug: pageSlug },
            include: { page_translations: true }
        });
        if (page && page.page_translations.length > 0) {
            const translation = page.page_translations.find(t => t.locale === locale)
                || page.page_translations.find(t => t.locale === 'es')
                || page.page_translations[0];

            const { title, content } = translation;
            const contentParts = content.split(/(\{\{category_id:[a-zA-Z0-9-]+\}\})/g);

            return (
                <div className="container py-12 md:py-16">
                    <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                        <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{title}</h1>
                        </header>
                        <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-primary)] hover:prose-a:text-[var(--color-primary-dark)] text-[var(--color-text-secondary)]">
                            {contentParts.map((part: string, index: number) => {
                                if (part.startsWith('{{category_id:')) {
                                    const slug = part.replace('{{category_id:', '').replace('}}', '');
                                    return <CategoryBlock key={index} categorySlug={slug} locale={locale} />;
                                }
                                return <div key={index} dangerouslySetInnerHTML={{ __html: part }} />;
                            })}
                        </div>
                    </div>
                </div>
            );
        }
    }

    notFound();
}
