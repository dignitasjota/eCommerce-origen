'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function createBlogPost(formData: FormData) {
    const slug = formData.get('slug') as string;
    const isPublished = formData.get('is_published') === 'true';
    const title = formData.get('title') as string;
    const excerpt = formData.get('excerpt') as string;
    const content = formData.get('content') as string;

    const locale = 'es';

    await prisma.blogPost.create({
        data: {
            id: crypto.randomUUID(),
            slug,
            is_published: isPublished,
            published_at: isPublished ? new Date() : null,
            blog_post_translations: {
                create: {
                    id: crypto.randomUUID(),
                    locale,
                    title,
                    excerpt,
                    content
                }
            }
        }
    });

    revalidatePath('/[locale]/admin/blog', 'page');
}

export async function updateBlogPost(id: string, formData: FormData) {
    const slug = formData.get('slug') as string;
    const isPublished = formData.get('is_published') === 'true';
    const title = formData.get('title') as string;
    const excerpt = formData.get('excerpt') as string;
    const content = formData.get('content') as string;

    const locale = 'es';

    // Retrieve the existing post to check if we need to set published_at
    const post = await prisma.blogPost.findUnique({ where: { id } });
    let newPublishedAt = post?.published_at;

    if (isPublished && !post?.published_at) {
        newPublishedAt = new Date(); // set it if it's being published for the first time
    }

    await prisma.$transaction([
        prisma.blogPost.update({
            where: { id },
            data: {
                slug,
                is_published: isPublished,
                published_at: newPublishedAt
            }
        }),
        prisma.blogPostTranslation.upsert({
            where: {
                blog_post_id_locale: {
                    blog_post_id: id,
                    locale: locale
                }
            },
            create: {
                id: crypto.randomUUID(),
                blog_post_id: id,
                locale,
                title,
                excerpt,
                content
            },
            update: {
                title,
                excerpt,
                content
            }
        })
    ]);

    revalidatePath('/[locale]/admin/blog', 'page');
}

export async function deleteBlogPost(id: string) {
    await prisma.blogPost.delete({
        where: { id }
    });
    revalidatePath('/[locale]/admin/blog', 'page');
}
