import prisma from '@/lib/db';
import ProductsManager from './ProductsManager';
import AdminPagination from '@/components/backoffice/AdminPagination';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProductsPage({ params, searchParams }: Props) {
    const { locale } = await params;
    const sp = await searchParams;
    const pageRaw = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = (page - 1) * PER_PAGE;

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            orderBy: { created_at: 'desc' },
            skip,
            take: PER_PAGE,
            include: {
                product_translations: { where: { locale: 'es' } },
                product_categories: {
                    include: {
                        categories: {
                            include: { category_translations: { where: { locale: 'es' } } }
                        }
                    }
                },
                product_variants: true,
                product_images: { orderBy: { sort_order: 'asc' } },
                related_to: true
            }
        }),
        prisma.product.count()
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const basePath = locale === 'es' ? '/admin/products' : `/${locale}/admin/products`;

    return (
        <>
            <ProductsManager products={products} />
            <AdminPagination basePath={basePath} page={page} totalPages={totalPages} />
        </>
    );
}
