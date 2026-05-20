'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { requireAdmin } from '@/lib/auth';

/**
 * Resuelve la imagen de categoría a partir del FormData:
 *   - Si hay un archivo nuevo en `image`, lo guarda y devuelve su URL.
 *   - Si NO hay archivo nuevo pero `images_order` indica que la imagen actual
 *     fue marcada como `deleted`, devuelve `null` y borra el archivo físico.
 *   - En caso contrario devuelve `undefined` (=> no tocar).
 */
async function resolveCategoryImage(
    formData: FormData,
    categoryId: string,
    currentImage: string | null
): Promise<string | null | undefined> {
    const mainImage = formData.get('image') as File | null;
    if (mainImage && mainImage.size > 0) {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'categories');
        await mkdir(uploadDir, { recursive: true }).catch(() => {});
        const ext = (mainImage.name.split('.').pop() || 'png').toLowerCase();
        const filename = `cat_${categoryId}_${Date.now()}.${ext}`;
        await writeFile(join(uploadDir, filename), Buffer.from(await mainImage.arrayBuffer()));
        // Si reemplazamos, borrar la anterior (best-effort).
        if (currentImage?.startsWith('/uploads/')) {
            await unlink(join(process.cwd(), 'public', currentImage)).catch(() => {});
        }
        return `/uploads/categories/${filename}`;
    }

    // Sin archivo nuevo: comprobar si el ImageUploader pidió borrar.
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
            // ignore malformed payload
        }
    }
    return undefined;
}

export async function createCategory(formData: FormData) {
    await requireAdmin(['ADMIN']);
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    const categoryId = crypto.randomUUID();
    const resolved = await resolveCategoryImage(formData, categoryId, null);
    const imageUrl = resolved === undefined ? null : resolved;

    await prisma.category.create({
        data: {
            id: categoryId,
            slug,
            parent_id: parentId || null,
            is_active: isActive,
            image: imageUrl,
            category_translations: {
                create: {
                    locale: 'es',
                    name,
                }
            }
        }
    });

    revalidatePath('/', 'layout');
}

export async function updateCategory(id: string, formData: FormData) {
    await requireAdmin(['ADMIN']);
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    const current = await prisma.category.findUnique({ where: { id }, select: { image: true } });
    const resolved = await resolveCategoryImage(formData, id, current?.image ?? null);

    const updateData: any = {
        slug,
        parent_id: parentId || null,
        is_active: isActive,
    };

    // resolved === undefined -> no tocar; null -> borrar; string -> reemplazar.
    if (resolved !== undefined) {
        updateData.image = resolved;
    }

    // Transaction to update category and translation
    await prisma.$transaction([
        prisma.category.update({
            where: { id },
            data: updateData
        }),
        prisma.categoryTranslation.upsert({
            where: {
                category_id_locale: {
                    category_id: id,
                    locale: 'es'
                }
            },
            update: {
                name
            },
            create: {
                category_id: id,
                locale: 'es',
                name
            }
        })
    ]);

    revalidatePath('/', 'layout');
}

export async function deleteCategory(id: string) {
    await requireAdmin(['ADMIN']);
    try {
        await prisma.category.delete({
            where: { id }
        });
        revalidatePath('/', 'layout');
    } catch (e: any) {
        throw new Error('No se puede eliminar la categoría si tiene productos asociados. Debe eliminarlos primero.');
    }
}
