import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Metadata } from 'next';
import prisma from '@/lib/db';

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
            include: { legal_page_translations: { where: { locale } } }
        });
        if (legalPage && legalPage.legal_page_translations[0]) {
            return {
                title: legalPage.legal_page_translations[0].title,
                description: `Información legal sobre ${legalPage.legal_page_translations[0].title}`,
            };
        }
    }

    // Comprobar si es Page
    const settingsMap = await prisma.siteSetting.findMany({
        where: { key: 'pages_prefix' }
    });
    const prefixSetting = settingsMap.find(s => s.key === 'pages_prefix');
    const prefix = prefixSetting ? prefixSetting.value : 'page';

    let pageSlug = null;
    if (prefix === '' && dynamicSlug.length === 1) {
        pageSlug = dynamicSlug[0];
    } else if (prefix !== '' && dynamicSlug.length === 2 && dynamicSlug[0] === prefix) {
        pageSlug = dynamicSlug[1];
    }

    if (pageSlug) {
        const page = await prisma.page.findUnique({
            where: { slug: pageSlug },
            include: { page_translations: { where: { locale } } }
        });
        if (page && page.page_translations[0]) {
            return {
                title: page.page_translations[0].title,
                description: page.page_translations[0].title,
            };
        }
    }

    return { title: 'Not Found' };
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
            include: { legal_page_translations: { where: { locale } } }
        });
        if (legalPage && legalPage.legal_page_translations[0]) {
            const { title, content } = legalPage.legal_page_translations[0];
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
    const settingsMap = await prisma.siteSetting.findMany({
        where: { key: 'pages_prefix' }
    });
    const prefixSetting = settingsMap.find(s => s.key === 'pages_prefix');
    const prefix = prefixSetting ? prefixSetting.value : 'page';

    let pageSlug = null;
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
            include: { page_translations: { where: { locale } } }
        });
        if (page && page.page_translations[0]) {
            const { title, content } = page.page_translations[0];
            return (
                <div className="container py-12 md:py-16">
                    <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                        <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                            <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{title}</h1>
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

    notFound();
}
