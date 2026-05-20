import { MetadataRoute } from 'next';
import prisma from '@/lib/db';

/**
 * Calcula prioridad/frecuencia dinámica en función de:
 *   - Edad del recurso (más reciente → mayor prioridad).
 *   - Si el producto está destacado (`is_featured`).
 *   - Tipo de recurso (página estática > productos > blog > legal).
 *
 * El objetivo es que Google rastree con más frecuencia lo que cambia más, y
 * priorice lo más nuevo en su crawl budget.
 */
function freshness(updatedAt: Date | null | undefined): {
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    boost: number;
} {
    if (!updatedAt) return { changeFrequency: 'monthly', boost: 0 };
    const days = (Date.now() - updatedAt.getTime()) / 86_400_000;
    if (days < 7) return { changeFrequency: 'daily', boost: 0.1 };
    if (days < 30) return { changeFrequency: 'weekly', boost: 0.05 };
    if (days < 180) return { changeFrequency: 'monthly', boost: 0 };
    return { changeFrequency: 'yearly', boost: -0.1 };
}

const clamp = (n: number) => Math.max(0, Math.min(1, +n.toFixed(2)));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const getUrl = (path: string, locale?: string) => {
        if (!locale || locale === 'es') return `${baseUrl}${path}`;
        return `${baseUrl}/${locale}${path}`;
    };

    const staticRoutes: MetadataRoute.Sitemap = [
        { url: getUrl('/'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: getUrl('/', 'en'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: getUrl('/products'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: getUrl('/products', 'en'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: getUrl('/categories'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: getUrl('/categories', 'en'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: getUrl('/blog'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: getUrl('/blog', 'en'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 }
    ];

    const [products, categories, posts, legalPages] = await Promise.all([
        prisma.product.findMany({
            select: { slug: true, updated_at: true, is_featured: true },
            where: { is_active: true }
        }),
        prisma.category.findMany({
            select: { slug: true, updated_at: true },
            where: { is_active: true }
        }),
        prisma.blogPost.findMany({
            select: { slug: true, updated_at: true, published_at: true },
            where: { is_published: true }
        }),
        prisma.legalPage.findMany({ select: { slug: true, updated_at: true } })
    ]);

    const dynamicRoutes: MetadataRoute.Sitemap = [];

    for (const product of products) {
        const f = freshness(product.updated_at);
        const priority = clamp((product.is_featured ? 0.9 : 0.7) + f.boost);
        dynamicRoutes.push({
            url: getUrl(`/product/${product.slug}`),
            lastModified: product.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
        dynamicRoutes.push({
            url: getUrl(`/product/${product.slug}`, 'en'),
            lastModified: product.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
    }

    for (const category of categories) {
        const f = freshness(category.updated_at);
        const priority = clamp(0.7 + f.boost);
        dynamicRoutes.push({
            url: getUrl(`/category/${category.slug}`),
            lastModified: category.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
        dynamicRoutes.push({
            url: getUrl(`/category/${category.slug}`, 'en'),
            lastModified: category.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
    }

    for (const post of posts) {
        // Para blog importa más la fecha de publicación que la de modificación.
        const f = freshness(post.published_at || post.updated_at);
        const priority = clamp(0.6 + f.boost);
        dynamicRoutes.push({
            url: getUrl(`/blog/${post.slug}`),
            lastModified: post.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
        dynamicRoutes.push({
            url: getUrl(`/blog/${post.slug}`, 'en'),
            lastModified: post.updated_at,
            changeFrequency: f.changeFrequency,
            priority
        });
    }

    for (const page of legalPages) {
        dynamicRoutes.push({
            url: getUrl(`/${page.slug}`),
            lastModified: page.updated_at,
            changeFrequency: 'monthly',
            priority: 0.4
        });
        dynamicRoutes.push({
            url: getUrl(`/${page.slug}`, 'en'),
            lastModified: page.updated_at,
            changeFrequency: 'monthly',
            priority: 0.4
        });
    }

    return [...staticRoutes, ...dynamicRoutes];
}
