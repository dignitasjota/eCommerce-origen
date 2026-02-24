'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createLegalPage(formData: FormData) {
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = formData.get('content') as string;

    await prisma.legalPage.create({
        data: {
            slug,
            legal_page_translations: {
                create: {
                    locale: 'es',
                    title,
                    content,
                }
            }
        }
    });

    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${slug}`);
}

export async function updateLegalPage(id: string, formData: FormData) {
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = formData.get('content') as string;

    // We fetch original to purge cache of old slug if it changed
    const original = await prisma.legalPage.findUnique({ where: { id } });

    await prisma.$transaction([
        prisma.legalPage.update({
            where: { id },
            data: {
                slug,
                updated_at: new Date()
            }
        }),
        prisma.legalPageTranslation.upsert({
            where: {
                legal_page_id_locale: {
                    legal_page_id: id,
                    locale: 'es'
                }
            },
            update: {
                title,
                content
            },
            create: {
                legal_page_id: id,
                locale: 'es',
                title,
                content
            }
        })
    ]);

    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${slug}`);
    if (original && original.slug !== slug) {
        revalidatePath(`/es/legal/${original.slug}`);
    }
}

export async function deleteLegalPage(id: string) {
    // Find the slug first to revalidate path correctly
    const page = await prisma.legalPage.findUnique({
        where: { id }
    });

    if (!page) throw new Error('Página no encontrada.');

    await prisma.legalPage.delete({
        where: { id }
    });

    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${page.slug}`);
}
