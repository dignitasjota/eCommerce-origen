'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { unlink } from 'fs/promises';
import { join } from 'path';

type ActionResult = { success: true } | { success: false; error: string };

export async function approveReview(id: string): Promise<ActionResult> {
    try {
        await requireAdmin();
        await prisma.review.update({ where: { id }, data: { is_approved: true } });
        await auditLog({ action: 'review.approve', entity_type: 'Review', entity_id: id });
        revalidatePath('/es/admin/reviews');
        revalidatePath('/es/product/[slug]', 'page');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: 'Error al aprobar la reseña.' };
    }
}

export async function unapproveReview(id: string): Promise<ActionResult> {
    try {
        await requireAdmin();
        await prisma.review.update({ where: { id }, data: { is_approved: false } });
        await auditLog({ action: 'review.unapprove', entity_type: 'Review', entity_id: id });
        revalidatePath('/es/admin/reviews');
        revalidatePath('/es/product/[slug]', 'page');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: 'Error al despublicar la reseña.' };
    }
}

export async function deleteReview(id: string): Promise<ActionResult> {
    try {
        await requireAdmin();
        const review = await prisma.review.delete({ where: { id } });

        // Borrado físico best-effort de las imágenes adjuntas (mismo criterio
        // que products/categories/blog: si el archivo es nuestro, en /uploads/,
        // se borra del disco; si falla, no bloquea la operación principal).
        if (review.images) {
            try {
                const urls: string[] = JSON.parse(review.images);
                await Promise.all(
                    urls
                        .filter((url) => url.startsWith('/uploads/'))
                        .map((url) => unlink(join(process.cwd(), 'public', url)).catch(() => {}))
                );
            } catch {
                // images malformado — nada que borrar, no bloquea el delete ya hecho.
            }
        }

        await auditLog({ action: 'review.delete', entity_type: 'Review', entity_id: id });
        revalidatePath('/es/admin/reviews');
        revalidatePath('/es/product/[slug]', 'page');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: 'Error al eliminar la reseña.' };
    }
}
