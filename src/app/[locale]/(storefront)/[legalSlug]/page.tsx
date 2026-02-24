import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Metadata } from 'next';
import prisma from '@/lib/db';

type Props = {
    params: Promise<{ locale: string; legalSlug: string }> | { locale: string; legalSlug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const resolvedParams = await params;
    const { legalSlug } = resolvedParams;
    const locale = await getLocale();

    const legalPage = await prisma.legalPage.findUnique({
        where: { slug: legalSlug },
        include: {
            legal_page_translations: {
                where: { locale }
            }
        }
    });

    if (!legalPage || !legalPage.legal_page_translations[0]) {
        return { title: 'Not Found' };
    }

    return {
        title: legalPage.legal_page_translations[0].title,
        description: `Información legal sobre ${legalPage.legal_page_translations[0].title}`,
    };
}

export default async function LegalPageView({ params }: Props) {
    const resolvedParams = await params;
    const { legalSlug } = resolvedParams;
    const locale = await getLocale();

    const legalPage = await prisma.legalPage.findUnique({
        where: { slug: legalSlug },
        include: {
            legal_page_translations: {
                where: { locale }
            }
        }
    });

    if (!legalPage || !legalPage.legal_page_translations[0]) {
        notFound();
    }

    const { title, content } = legalPage.legal_page_translations[0];

    return (
        <div className="container py-12 md:py-16">
            <div className="max-w-4xl mx-auto bg-[var(--color-surface)] p-8 md:p-12 rounded-2xl shadow-sm border border-[var(--color-border)]">
                <header className="mb-10 border-b border-[var(--color-border)] pb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">{title}</h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Última actualización: {new Date(legalPage.updated_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
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
