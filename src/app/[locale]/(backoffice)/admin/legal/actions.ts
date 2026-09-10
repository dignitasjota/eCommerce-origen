'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/sanitize';
import { auditLog } from '@/lib/audit';

export async function createLegalPage(formData: FormData) {
    await requireAdmin(undefined, 'legal.manage');
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = sanitizeHtml(formData.get('content') as string);

    const created = await prisma.legalPage.create({
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

    await auditLog({ action: 'legal_page.create', entity_type: 'LegalPage', entity_id: created.id, metadata: { slug, title } });
    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${slug}`);
}

export async function updateLegalPage(id: string, formData: FormData) {
    await requireAdmin(undefined, 'legal.manage');
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const content = sanitizeHtml(formData.get('content') as string);

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

    await auditLog({ action: 'legal_page.update', entity_type: 'LegalPage', entity_id: id, metadata: { slug, title, previous_slug: original?.slug } });
    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${slug}`);
    if (original && original.slug !== slug) {
        revalidatePath(`/es/legal/${original.slug}`);
    }
}

export async function deleteLegalPage(id: string) {
    await requireAdmin(undefined, 'legal.manage');
    // Find the slug first to revalidate path correctly
    const page = await prisma.legalPage.findUnique({
        where: { id }
    });

    if (!page) throw new Error('Página no encontrada.');

    await prisma.legalPage.delete({
        where: { id }
    });

    await auditLog({ action: 'legal_page.delete', entity_type: 'LegalPage', entity_id: id, metadata: { slug: page.slug } });
    revalidatePath('/es/admin/legal');
    revalidatePath(`/es/legal/${page.slug}`);
}
