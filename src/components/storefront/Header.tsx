import { getLocale } from 'next-intl/server';
import prisma from '@/lib/db';
import HeaderClient from './HeaderClient';

export default async function Header() {
    const locale = await getLocale();

    // Fetch top-level categories for navigation
    const dbCategories = await prisma.category.findMany({
        where: {
            is_active: true,
            parent_id: null
        },
        orderBy: { sort_order: 'asc' },
        take: 5,
        include: {
            category_translations: {
                where: { locale }
            }
        }
    });

    const categories = dbCategories.map(cat => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.category_translations[0]?.name || cat.slug
    }));

    // Fase 11: Feature Flags
    const settings = await prisma.siteSetting.findMany({
        where: { key: { in: ['feature_blog_enabled', 'feature_wishlist_enabled'] } }
    });

    const isFeatureEnabled = (key: string) => {
        const setting = settings.find(s => s.key === key);
        return setting ? setting.value === 'true' : true; // Por defecto encendidos
    };

    const features = {
        blog: isFeatureEnabled('feature_blog_enabled'),
        wishlist: isFeatureEnabled('feature_wishlist_enabled'),
    };

    return (
        <HeaderClient categories={categories} features={features} />
    );
}
