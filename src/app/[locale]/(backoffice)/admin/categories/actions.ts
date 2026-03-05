'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function handleImageUpload(formData: FormData, categoryId: string): Promise<string | null> {
    const mainImage = formData.get('image') as File | null;
    if (mainImage && mainImage.size > 0) {
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'categories');
        await mkdir(uploadDir, { recursive: true }).catch(() => { });

        const ext = mainImage.name.split('.').pop() || 'png';
        const filename = `cat_${categoryId}_${Date.now()}.${ext}`;
        const filepath = join(uploadDir, filename);
        const buffer = Buffer.from(await mainImage.arrayBuffer());
        await writeFile(filepath, buffer);

        return `/uploads/categories/${filename}`;
    }
    return null;
}

export async function createCategory(formData: FormData) {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    const categoryId = crypto.randomUUID();
    const imageUrl = await handleImageUpload(formData, categoryId);

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
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parent_id') as string | null;
    const isActive = formData.get('is_active') === 'true';

    const imageUrl = await handleImageUpload(formData, id);

    const updateData: any = {
        slug,
        parent_id: parentId || null,
        is_active: isActive,
    };

    if (imageUrl) {
        updateData.image = imageUrl;
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
    try {
        await prisma.category.delete({
            where: { id }
        });
        revalidatePath('/', 'layout');
    } catch (e: any) {
        throw new Error('No se puede eliminar la categoría si tiene productos asociados. Debe eliminarlos primero.');
    }
}
