import { getTranslations, setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function CategoriesPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);

    const tNav = await getTranslations('nav');

    // Fetch all active categories
    const categories = await prisma.category.findMany({
        where: {
            is_active: true,
        },
        orderBy: { sort_order: 'asc' },
        include: {
            category_translations: { where: { locale } }
        }
    });

    return (
        <div className="container py-12 md:py-16">
            <header className="mb-10 text-center">
                <h1 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] mb-4">
                    {tNav('categories')}
                </h1>
                <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
                    Explora nuestra amplia gama de productos clasificados por categoría.
                </p>
            </header>

            {categories.length === 0 ? (
                <div className="text-center py-12 text-[var(--color-text-secondary)]">
                    <p>No hay categorías disponibles en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {categories.map(category => {
                        const translation = category.category_translations[0];
                        const name = translation?.name || category.slug;

                        return (
                            <Link
                                key={category.id}
                                href={`/category/${category.slug}`}
                                className="group relative overflow-hidden rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 block h-64"
                            >
                                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center relative overflow-hidden h-full">
                                    {category.image ? (
                                        <img
                                            src={category.image}
                                            alt={name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[var(--color-primary)] opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                                            <span className="text-6xl text-[var(--color-primary)] filter grayscale">📁</span>
                                        </div>
                                    )}
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

                                    {/* Text Content */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <h3 className="text-2xl font-bold text-white drop-shadow-md pb-1 border-b-2 border-transparent group-hover:border-[var(--color-primary)] inline-block transition-all duration-300">
                                            {name}
                                        </h3>
                                        <p className="text-white/80 text-sm mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                                            Ver productos →
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
