'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createCategory(formData: FormData) {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    await prisma.category.create({
        data: {
            slug,
            parent_id: parentId || null,
            is_active: isActive,
            category_translations: {
                create: {
                    locale: 'es',
                    name,
                }
            }
        }
    });

    revalidatePath('/es/admin/categories');
}

export async function updateCategory(id: string, formData: FormData) {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    // Transaction to update category and translation
    await prisma.$transaction([
        prisma.category.update({
            where: { id },
            data: {
                slug,
                parent_id: parentId || null,
                is_active: isActive,
            }
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

    revalidatePath('/es/admin/categories');
}

export async function deleteCategory(id: string) {
    try {
        await prisma.category.delete({
            where: { id }
        });
        revalidatePath('/es/admin/categories');
    } catch (e: any) {
        throw new Error('No se puede eliminar la categoría si tiene productos asociados. Debe eliminarlos primero.');
    }
}
