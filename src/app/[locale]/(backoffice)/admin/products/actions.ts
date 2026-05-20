'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { sanitizeHtml } from '@/lib/sanitize';
import { auditLog } from '@/lib/audit';

interface ImageOrderEntry {
    id: string;
    sort_order: number;
    deleted?: boolean;
}

function parseImagesOrder(raw: string | null): ImageOrderEntry[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed
            .filter(
                (e): e is ImageOrderEntry =>
                    e && typeof e.id === 'string' && typeof e.sort_order === 'number'
            )
            .map((e) => ({ id: e.id, sort_order: e.sort_order, deleted: !!e.deleted }));
    } catch {
        return null;
    }
}

/**
 * Procesa imágenes:
 *   1. Aplica reorder/delete sobre las imágenes existentes según `images_order`.
 *   2. Sube los archivos nuevos del input `gallery_images` (compat: también
 *      acepta `main_image` legacy si llega).
 *   3. Renumera `sort_order` consecutivamente — la primera (0) es la principal.
 */
async function handleImagesUpload(formData: FormData, productId: string) {
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true }).catch(() => {});

    // 1) Reorder + delete sobre existentes ────────────────────────────────
    const orderRaw = formData.get('images_order') as string | null;
    const order = parseImagesOrder(orderRaw);

    if (order) {
        const toDelete = order.filter((e) => e.deleted);
        if (toDelete.length > 0) {
            const ids = toDelete.map((e) => e.id);
            const rows = await prisma.productImage.findMany({
                where: { id: { in: ids }, product_id: productId },
                select: { id: true, url: true }
            });
            // Borrar archivo físico si está en /uploads/ (best-effort).
            await Promise.all(
                rows.map(async (r) => {
                    if (r.url.startsWith('/uploads/')) {
                        await unlink(join(process.cwd(), 'public', r.url)).catch(() => {});
                    }
                })
            );
            await prisma.productImage.deleteMany({
                where: { id: { in: ids }, product_id: productId }
            });
        }

        // Reorder: aplicamos sort_order según posición en `order` (excluyendo deleted).
        const remaining = order.filter((e) => !e.deleted);
        await prisma.$transaction(
            remaining.map((e, idx) =>
                prisma.productImage.updateMany({
                    where: { id: e.id, product_id: productId },
                    data: { sort_order: idx }
                })
            )
        );
    }

    // 2) Subir imágenes nuevas ────────────────────────────────────────────
    const newFiles: File[] = [
        ...(formData.getAll('gallery_images') as File[]),
        ...(formData.getAll('main_image') as File[]) // compat legacy
    ].filter((f) => f && f.size > 0);

    if (newFiles.length === 0) return;

    const currentMax = await prisma.productImage.aggregate({
        where: { product_id: productId },
        _max: { sort_order: true }
    });
    let nextSortOrder = (currentMax._max.sort_order ?? -1) + 1;

    for (const file of newFiles) {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const filename = `product_${productId}_${Date.now()}_${nextSortOrder}.${ext}`;
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

export async function createProduct(formData: FormData) {
    await requireAdmin();
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;
    const description = sanitizeHtml(formData.get('description') as string);
    const unlimitedStock = formData.get('unlimited_stock') === 'true';
    const stockStr = formData.get('stock') as string;
    const stock = unlimitedStock ? 0 : parseInt(stockStr || '0', 10);

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
            unlimited_stock: unlimitedStock,
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

    await auditLog({
        action: 'product.create',
        entity_type: 'Product',
        entity_id: productId,
        metadata: { slug, sku, price }
    });

    revalidatePath('/', 'layout');
}

export async function updateProduct(id: string, formData: FormData) {
    await requireAdmin();
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;
    const description = sanitizeHtml(formData.get('description') as string);
    const unlimitedStock = formData.get('unlimited_stock') === 'true';
    const stockStr = formData.get('stock') as string;
    const stock = unlimitedStock ? 0 : parseInt(stockStr || '0', 10);

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
                is_active: isActive,
                unlimited_stock: unlimitedStock
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

    await auditLog({
        action: 'product.update',
        entity_type: 'Product',
        entity_id: id,
        metadata: { slug, sku, price, is_active: isActive }
    });

    revalidatePath('/', 'layout');
}

export async function deleteProduct(id: string) {
    await requireAdmin();
    const existing = await prisma.product.findUnique({ where: { id }, select: { slug: true, sku: true } });
    await prisma.product.delete({
        where: { id }
    });
    await auditLog({
        action: 'product.delete',
        entity_type: 'Product',
        entity_id: id,
        metadata: existing ? { slug: existing.slug, sku: existing.sku } : undefined
    });
    revalidatePath('/', 'layout');
}

export async function updateProductRelations(
    productId: string,
    crossSellIds: string[],
    upSellIds: string[]
) {
    try {
        await requireAdmin();
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
        if (error instanceof AuthorizationError) {
            return { success: false, error: error.message };
        }
        console.error("Error updating product relations:", error);
        return { success: false, error: 'Hubo un error guardando las relaciones' };
    }
}
