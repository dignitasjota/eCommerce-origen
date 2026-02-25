'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function handleImagesUpload(formData: FormData, productId: string) {
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true }).catch(() => { });

    const mainImage = formData.get('main_image') as File | null;
    if (mainImage && mainImage.size > 0) {
        // Find existing main image (sort_order = 0)
        const ext = mainImage.name.split('.').pop() || 'png';
        const filename = `product_${productId}_main_${Date.now()}.${ext}`;
        const filepath = join(uploadDir, filename);
        const buffer = Buffer.from(await mainImage.arrayBuffer());
        await writeFile(filepath, buffer);

        // Delete existing main image from DB 
        await prisma.productImage.deleteMany({
            where: { product_id: productId, sort_order: 0 }
        });

        await prisma.productImage.create({
            data: {
                id: crypto.randomUUID(),
                product_id: productId,
                url: `/uploads/${filename}`,
                sort_order: 0
            }
        });
    }

    const galleryImages = formData.getAll('gallery_images') as File[];
    let currentGalleryCount = await prisma.productImage.count({
        where: { product_id: productId }
    });

    // Start sort_order from highest existing to just append
    let nextSortOrder = currentGalleryCount > 0 ? currentGalleryCount + 1 : 1;

    for (const file of galleryImages) {
        if (file && file.size > 0) {
            const ext = file.name.split('.').pop() || 'png';
            const filename = `product_${productId}_gal_${Date.now()}_${nextSortOrder}.${ext}`;
            const filepath = join(uploadDir, filename);
            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(filepath, buffer);

            await prisma.productImage.create({
                data: {
                    id: crypto.randomUUID(),
                    product_id: productId,
                    url: `/uploads/${filename}`,
                    sort_order: nextSortOrder
                }
            });
            nextSortOrder++;
        }
    }
}

export async function createProduct(formData: FormData) {
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const stockStr = formData.get('stock') as string;
    const stock = parseInt(stockStr || '0', 10);

    const price = parseFloat(priceStr);
    if (isNaN(price)) throw new Error('Precio inválido');

    const locale = 'es';
    const productId = crypto.randomUUID();

    await prisma.product.create({
        data: {
            id: productId,
            slug,
            sku,
            price,
            is_active: isActive,
            product_translations: {
                create: {
                    id: crypto.randomUUID(),
                    locale,
                    name,
                    description
                }
            },
            product_variants: {
                create: {
                    id: crypto.randomUUID(),
                    sku: sku, // base variant mirrors product sku
                    price: price,
                    stock: isNaN(stock) ? 0 : stock
                }
            }
        }
    });

    await handleImagesUpload(formData, productId);

    revalidatePath('/[locale]/admin/products', 'page');
}

export async function updateProduct(id: string, formData: FormData) {
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const stockStr = formData.get('stock') as string;
    const stock = parseInt(stockStr || '0', 10);

    const price = parseFloat(priceStr);
    if (isNaN(price)) throw new Error('Precio inválido');

    const locale = 'es';

    await prisma.$transaction([
        prisma.product.update({
            where: { id },
            data: {
                slug,
                sku,
                price,
                is_active: isActive
            }
        }),
        prisma.productTranslation.upsert({
            where: {
                product_id_locale: {
                    product_id: id,
                    locale: locale
                }
            },
            create: {
                id: crypto.randomUUID(),
                product_id: id,
                locale,
                name,
                description
            },
            update: {
                name,
                description
            }
        })
    ]);

    // Handle single variant stock if it exists or create one if it doesn't
    const variants = await prisma.productVariant.findMany({ where: { product_id: id } });
    if (variants.length > 0) {
        // update the first variant
        await prisma.productVariant.update({
            where: { id: variants[0].id },
            data: { stock: isNaN(stock) ? 0 : stock }
        });
    } else {
        // create a base variant if somehow missing
        await prisma.productVariant.create({
            data: {
                id: crypto.randomUUID(),
                product_id: id,
                sku: sku,
                price: price,
                stock: isNaN(stock) ? 0 : stock
            }
        });
    }

    await handleImagesUpload(formData, id);

    revalidatePath('/[locale]/admin/products', 'page');
}

export async function deleteProduct(id: string) {
    await prisma.product.delete({
        where: { id }
    });
    revalidatePath('/[locale]/admin/products', 'page');
}

export async function updateProductRelations(
    productId: string,
    crossSellIds: string[],
    upSellIds: string[]
) {
    try {
        await prisma.relatedProduct.deleteMany({
            where: { product_id: productId }
        });

        const newRelations = [];

        for (const relatedId of crossSellIds) {
            newRelations.push({
                product_id: productId,
                related_product_id: relatedId,
                relation_type: 'CROSS_SELL' as const
            });
        }

        for (const relatedId of upSellIds) {
            newRelations.push({
                product_id: productId,
                related_product_id: relatedId,
                relation_type: 'UP_SELL' as const
            });
        }

        if (newRelations.length > 0) {
            await prisma.relatedProduct.createMany({
                data: newRelations
            });
        }

        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error) {
        console.error("Error updating product relations:", error);
        return { success: false, error: 'Hubo un error guardando las relaciones' };
    }
}
