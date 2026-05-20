'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/sanitize';

export async function createPage(formData: FormData) {
    await requireAdmin();
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = sanitizeHtml(formData.get('content') as string);

    await prisma.page.create({
        data: {
            slug,
            page_translations: {
                create: {
                    locale: 'es',
                    title,
                    content,
                }
            }
        }
    });

    revalidatePath('/', 'layout');
}

export async function updatePage(id: string, formData: FormData) {
    await requireAdmin();
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = sanitizeHtml(formData.get('content') as string);

    const original = await prisma.page.findUnique({ where: { id } });

    await prisma.$transaction([
        prisma.page.update({
            where: { id },
            data: {
                slug,
                updated_at: new Date()
            }
        }),
        prisma.pageTranslation.upsert({
            where: {
                page_id_locale: {
                    page_id: id,
                    locale: 'es'
                }
            },
            update: {
                title,
                content
            },
            create: {
                page_id: id,
                locale: 'es',
                title,
                content
            }
        })
    ]);

    revalidatePath('/', 'layout');
}

export async function deletePage(id: string) {
    await requireAdmin();
    const page = await prisma.page.findUnique({
        where: { id }
    });

    if (!page) throw new Error('Página no encontrada.');

    await prisma.page.delete({
        where: { id }
    });

    revalidatePath('/', 'layout');
}
