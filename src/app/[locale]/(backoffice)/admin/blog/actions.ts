'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtml, sanitizeText } from '@/lib/sanitize';

/**
 * Resuelve la imagen de portada (cover) de un post de blog leyendo `image`
 * y `images_order` del FormData. Misma semántica que en categorías:
 *   - File nuevo: se guarda y se devuelve la URL.
 *   - `images_order` con `{id:'current', deleted:true}` y sin file: devuelve null.
 *   - Resto: undefined (no tocar).
 */
async function resolveBlogCover(
    formData: FormData,
    postId: string,
    currentImage: string | null
): Promise<string | null | undefined> {
    const file = formData.get('image') as File | null;
    if (file && file.size > 0) {
        const dir = join(process.cwd(), 'public', 'uploads', 'blog');
        await mkdir(dir, { recursive: true }).catch(() => {});
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const filename = `blog_${postId}_${Date.now()}.${ext}`;
        await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()));
        if (currentImage?.startsWith('/uploads/')) {
            await unlink(join(process.cwd(), 'public', currentImage)).catch(() => {});
        }
        return `/uploads/blog/${filename}`;
    }
    const orderRaw = formData.get('images_order') as string | null;
    if (orderRaw && currentImage) {
        try {
            const arr = JSON.parse(orderRaw);
            if (Array.isArray(arr) && arr.some((e) => e?.id === 'current' && e?.deleted)) {
                if (currentImage.startsWith('/uploads/')) {
                    await unlink(join(process.cwd(), 'public', currentImage)).catch(() => {});
                }
                return null;
            }
        } catch {
            // ignore
        }
    }
    return undefined;
}

export async function createBlogPost(formData: FormData) {
    await requireAdmin();
    const slug = formData.get('slug') as string;
    const isPublished = formData.get('is_published') === 'true';
    const title = formData.get('title') as string;
    const excerpt = sanitizeText(formData.get('excerpt') as string);
    const content = sanitizeHtml(formData.get('content') as string);

    const locale = 'es';
    const postId = crypto.randomUUID();
    const resolved = await resolveBlogCover(formData, postId, null);

    await prisma.blogPost.create({
        data: {
            id: postId,
            slug,
            image: resolved === undefined ? null : resolved,
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
    await requireAdmin();
    const slug = formData.get('slug') as string;
    const isPublished = formData.get('is_published') === 'true';
    const title = formData.get('title') as string;
    const excerpt = sanitizeText(formData.get('excerpt') as string);
    const content = sanitizeHtml(formData.get('content') as string);

    const locale = 'es';

    // Retrieve the existing post to check if we need to set published_at
    const post = await prisma.blogPost.findUnique({ where: { id } });
    let newPublishedAt = post?.published_at;

    if (isPublished && !post?.published_at) {
        newPublishedAt = new Date(); // set it if it's being published for the first time
    }

    const resolvedCover = await resolveBlogCover(formData, id, post?.image ?? null);
    const blogUpdateData: { slug: string; is_published: boolean; published_at: Date | null; image?: string | null } = {
        slug,
        is_published: isPublished,
        published_at: newPublishedAt ?? null
    };
    if (resolvedCover !== undefined) blogUpdateData.image = resolvedCover;

    await prisma.$transaction([
        prisma.blogPost.update({
            where: { id },
            data: blogUpdateData
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
    await requireAdmin();
    await prisma.blogPost.delete({
        where: { id }
    });
    revalidatePath('/[locale]/admin/blog', 'page');
}
