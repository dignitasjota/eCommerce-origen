import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Metadata } from 'next';
import Image from 'next/image';
import prisma from '@/lib/db';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseShortcodes } from '@/lib/shortcodes';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ locale: string; dynamicSlug: string[] }> | { locale: string; dynamicSlug: string[] };
};

// Busca una Page normal por cualquier segmento del slug (funciona con y sin prefix)
async function findPageBySlug(segments: string[]) {
    for (const segment of segments) {
        const page = await prisma.page.findUnique({
            where: { slug: segment },
            include: { page_translations: true }
        });
        if (page && page.page_translations.length > 0) return page;
    }
    return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const resolvedParams = await params;
    const { dynamicSlug } = resolvedParams;
    const locale = await getLocale();

    // 1. Comprobar si es página legal
    if (dynamicSlug.length === 1) {
        const legalPage = await prisma.legalPage.findUnique({
            where: { slug: dynamicSlug[0] },
            include: { legal_page_translations: true }
        });
        if (legalPage && legalPage.legal_page_translations.length > 0) {
            const t = legalPage.legal_page_translations.find(t => t.locale === locale)
                || legalPage.legal_page_translations.find(t => t.locale === 'es')
                || legalPage.legal_page_translations[0];
            return { title: t.title, description: `Información legal sobre ${t.title}` };
        }
    }

    // 2. Comprobar si es página de contenido
    const page = await findPageBySlug(dynamicSlug);
    if (page) {
        const t = page.page_translations.find(t => t.locale === locale)
            || page.page_translations.find(t => t.locale === 'es')
            || page.page_translations[0];
        return { title: t.title, description: t.title };
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
                            href={`/${locale}/product/${p.slug}`}
                            className={`card product-card animate-fade-in-up stagger-${(index % 12) + 1}`}
                            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
                        >
                            <figure className="aspect-[4/5] overflow-hidden bg-[var(--color-background)] relative group">
                                {image ? (
                                    <Image
                                        src={image}
                                        alt={name}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                        style={{ objectFit: 'cover' }}
                                    />
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

    // 1. Renderizado Legal (solo 1 segmento)
    if (dynamicSlug.length === 1) {
        const legalPage = await prisma.legalPage.findUnique({
            where: { slug: dynamicSlug[0] },
            include: { legal_page_translations: true }
        });
        if (legalPage && legalPage.legal_page_translations.length > 0) {
            const translation = legalPage.legal_page_translations.find(t => t.locale === locale)
                || legalPage.legal_page_translations.find(t => t.locale === 'es')
                || legalPage.legal_page_translations[0];

            return (
                <div className="container py-12 md:py-16">
                    <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                        <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{translation.title}</h1>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Última actualización: {new Date(legalPage.updated_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                })}
                            </p>
                        </header>
                        <div
                            className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-primary)] hover:prose-a:text-[var(--color-primary-dark)] text-[var(--color-text-secondary)]"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(translation.content) }}
                        />
                    </div>
                </div>
            );
        }
    }

    // 2. Renderizado Page Normal
    const page = await findPageBySlug(dynamicSlug);
    if (page) {
        const translation = page.page_translations.find(t => t.locale === locale)
            || page.page_translations.find(t => t.locale === 'es')
            || page.page_translations[0];

        const { title, content } = translation;
        const nodes = parseShortcodes(content);

        return (
            <div className="container py-12 md:py-16">
                <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                    <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{title}</h1>
                    </header>
                    <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-primary)] hover:prose-a:text-[var(--color-primary-dark)] text-[var(--color-text-secondary)]">
                        {nodes.map((node, index) => {
                            if (node.type === 'shortcode' && node.name === 'category_id') {
                                return <CategoryBlock key={index} categorySlug={node.arg} locale={locale} />;
                            }
                            // node.type === 'html' — el contenido ya pasó por
                            // sanitizeHtml() al guardar (Sprint 1 §5). Volvemos
                            // a sanitizar como defensa-en-profundidad por si la
                            // página tiene contenido legacy pre-sanitización.
                            return (
                                <div
                                    key={index}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml((node as { content: string }).content) }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    notFound();
}
