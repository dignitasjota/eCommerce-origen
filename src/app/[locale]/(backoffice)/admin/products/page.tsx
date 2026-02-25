import prisma from '@/lib/db';
import ProductsManager from './ProductsManager';

async function getProducts() {
    return prisma.product.findMany({
        orderBy: { created_at: 'desc' },
        include: {
            product_translations: { where: { locale: 'es' } },
            product_categories: {
                include: {
                    categories: {
                        include: { category_translations: { where: { locale: 'es' } } },
                    },
                },
            },
            product_variants: true,
            product_images: { orderBy: { sort_order: 'asc' } },
        },
    });
}

export default async function ProductsPage() {
    const products = await getProducts();

    return <ProductsManager products={products} />;
}
