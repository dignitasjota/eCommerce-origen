import prisma from '@/lib/db';
import CategoriesManager from './CategoriesManager';

async function getCategories() {
    return prisma.category.findMany({
        orderBy: { sort_order: 'asc' },
        include: {
            category_translations: { where: { locale: 'es' } },
            categories: {
                select: { category_translations: { where: { locale: 'es' }, select: { name: true } } },
            },
            other_categories: {
                include: { category_translations: { where: { locale: 'es' } } },
                orderBy: { sort_order: 'asc' },
            },
            _count: { select: { product_categories: true } },
        },
    });
}

export default async function CategoriesPage() {
    const categories = await getCategories();
    // Use categories that don't have a parent as root categories
    const parentCategories = categories.filter((c: any) => !c.parent_id);

    return (
        <CategoriesManager
            initialCategories={parentCategories}
            allParentCategories={parentCategories}
        />
    );
}
