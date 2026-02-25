import prisma from '@/lib/db';
import BlogManager from './BlogManager';

async function getBlogPosts() {
    return prisma.blogPost.findMany({
        orderBy: { created_at: 'desc' },
        include: { blog_post_translations: { where: { locale: 'es' } } },
    });
}

export default async function BlogPage() {
    const posts = await getBlogPosts();
    return <BlogManager posts={posts} />;
}
