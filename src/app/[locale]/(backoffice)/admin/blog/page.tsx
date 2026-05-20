import prisma from '@/lib/db';
import BlogManager from './BlogManager';
import AdminPagination from '@/components/backoffice/AdminPagination';

const PER_PAGE = 25;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BlogPage({ params, searchParams }: Props) {
    const { locale } = await params;
    const sp = await searchParams;

    const pageRaw = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = (page - 1) * PER_PAGE;

    const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
            orderBy: { created_at: 'desc' },
            skip,
            take: PER_PAGE,
            include: { blog_post_translations: { where: { locale: 'es' } } }
        }),
        prisma.blogPost.count()
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const basePath = locale === 'es' ? '/admin/blog' : `/${locale}/admin/blog`;

    return (
        <>
            <BlogManager posts={posts} />
            <AdminPagination basePath={basePath} page={page} totalPages={totalPages} />
        </>
    );
}
