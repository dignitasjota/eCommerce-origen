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
    // Fase 11: Feature Flags
    const settings = await prisma.siteSetting.findMany({
        where: { key: { in: ['feature_blog_enabled', 'feature_wishlist_enabled', 'feature_contact_enabled', 'main_menu', 'site_name', 'site_logo'] } }
    });

    const isFeatureEnabled = (key: string) => {
        const setting = settings.find(s => s.key === key);
        return setting ? setting.value === 'true' : true; // Por defecto encendidos
    };

    const features = {
        blog: isFeatureEnabled('feature_blog_enabled'),
        wishlist: isFeatureEnabled('feature_wishlist_enabled'),
        contact: isFeatureEnabled('feature_contact_enabled')
    };

    type MenuItem = { id: string; label: string; type: 'link' | 'categories'; url?: string };

    const defaultMenu: MenuItem[] = [
        { id: '1', label: 'Inicio', type: 'link', url: '/' },
        { id: '2', label: 'Tienda', type: 'categories' },
        { id: '3', label: 'Catálogo', type: 'link', url: '/products' },
        { id: '4', label: 'Blog', type: 'link', url: '/blog' }
    ];

    const mainMenuSetting = settings.find(s => s.key === 'main_menu');
    let mainMenu = defaultMenu;
    if (mainMenuSetting) {
        try {
            mainMenu = JSON.parse(mainMenuSetting.value);
        } catch (e) {
            mainMenu = defaultMenu;
        }
    }

    const siteName = settings.find(s => s.key === 'site_name')?.value || 'eShop';
    const siteLogo = settings.find(s => s.key === 'site_logo')?.value || '';

    return (
        <HeaderClient categories={categories} features={features} menuItems={mainMenu} siteName={siteName} siteLogo={siteLogo} />
    );
}
