import { MetadataRoute } from 'next';
import prisma from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Función auxiliar para instanciar rutas multi-idioma
    const getUrl = (path: string, locale?: string) => {
        if (!locale || locale === 'es') return `${baseUrl}${path}`;
        return `${baseUrl}/${locale}${path}`;
    };

    // 1. Rutas estáticas principales
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: getUrl('/'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: getUrl('/', 'en'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: getUrl('/products'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: getUrl('/products', 'en'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: getUrl('/categories'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: getUrl('/categories', 'en'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: getUrl('/blog'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: getUrl('/blog', 'en'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ];

    // 2. Fetch dinámico desde Prisma
    const [products, categories, posts, legalPages] = await Promise.all([
        prisma.product.findMany({ select: { slug: true, updated_at: true }, where: { is_active: true } }),
        prisma.category.findMany({ select: { slug: true, updated_at: true }, where: { is_active: true } }),
        prisma.blogPost.findMany({ select: { slug: true, updated_at: true }, where: { is_published: true } }),
        prisma.legalPage.findMany({ select: { slug: true, updated_at: true } })
    ]);

    // 3. Transformación de Rutas Dinámicas
    const dynamicRoutes: MetadataRoute.Sitemap = [];

    // Productos
    products.forEach((product) => {
        dynamicRoutes.push({ url: getUrl(`/product/${product.slug}`), lastModified: product.updated_at, changeFrequency: 'daily', priority: 0.9 });
        dynamicRoutes.push({ url: getUrl(`/product/${product.slug}`, 'en'), lastModified: product.updated_at, changeFrequency: 'daily', priority: 0.9 });
    });

    // Categorías
    categories.forEach((category) => {
        dynamicRoutes.push({ url: getUrl(`/category/${category.slug}`), lastModified: category.updated_at, changeFrequency: 'weekly', priority: 0.8 });
        dynamicRoutes.push({ url: getUrl(`/category/${category.slug}`, 'en'), lastModified: category.updated_at, changeFrequency: 'weekly', priority: 0.8 });
    });

    // Blog
    posts.forEach((post) => {
        dynamicRoutes.push({ url: getUrl(`/blog/${post.slug}`), lastModified: post.updated_at, changeFrequency: 'weekly', priority: 0.7 });
        dynamicRoutes.push({ url: getUrl(`/blog/${post.slug}`, 'en'), lastModified: post.updated_at, changeFrequency: 'weekly', priority: 0.7 });
    });

    // Páginas Legales
    legalPages.forEach((page) => {
        dynamicRoutes.push({ url: getUrl(`/${page.slug}`), lastModified: page.updated_at, changeFrequency: 'monthly', priority: 0.5 });
        dynamicRoutes.push({ url: getUrl(`/${page.slug}`, 'en'), lastModified: page.updated_at, changeFrequency: 'monthly', priority: 0.5 });
    });

    return [...staticRoutes, ...dynamicRoutes];
}
