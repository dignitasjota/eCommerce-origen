'use server';

import prisma from '@/lib/db';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { recordStockMovement } from '@/lib/stock';
import { auditLog } from '@/lib/audit';

interface VariantInput {
    sku: string;
    price: string | null; // null → hereda del producto
    stock: string;
    is_active: boolean;
}

function parseVariant(input: VariantInput) {
    const sku = (input.sku || '').trim();
    if (!sku) throw new Error('SKU requerido para la variante');

    const stock = parseInt(input.stock || '0', 10);
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock inválido');

    let price: number | null = null;
    if (input.price !== null && input.price !== '' && input.price !== undefined) {
        const p = parseFloat(input.price);
        if (!Number.isFinite(p) || p < 0) throw new Error('Precio inválido');
        price = p;
    }

    return { sku, stock, price, is_active: !!input.is_active };
}

export async function createVariant(productId: string, input: VariantInput) {
    try {
        const session = await requireAdmin();
        const data = parseVariant(input);

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return { success: false, error: 'Producto no encontrado.' };

        const variantId = crypto.randomUUID();
        await prisma.productVariant.create({
            data: {
                id: variantId,
                product_id: productId,
                sku: data.sku,
                stock: data.stock,
                price: data.price,
                is_active: data.is_active
            }
        });

        // Registrar el stock inicial como RESTOCK (entrada manual del admin).
        if (data.stock > 0) {
            await recordStockMovement({
                variant_id: variantId,
                quantity: data.stock,
                reason: 'RESTOCK',
                note: 'Stock inicial al crear variante',
                user_id: session.user.id
            });
        }
        await auditLog({
            action: 'variant.create',
            entity_type: 'ProductVariant',
            entity_id: variantId,
            metadata: { product_id: productId, sku: data.sku, stock: data.stock }
        });

        revalidatePath(`/[locale]/admin/products/${productId}/edit`, 'page');
        revalidatePath(`/[locale]/product/${product.slug}`, 'page');
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        if (error?.code === 'P2002') return { success: false, error: 'Ya existe una variante con ese SKU.' };
        return { success: false, error: error?.message || 'No se pudo crear la variante.' };
    }
}

export async function updateVariant(variantId: string, input: VariantInput) {
    try {
        const session = await requireAdmin();
        const data = parseVariant(input);

        const existing = await prisma.productVariant.findUnique({
            where: { id: variantId },
            include: { products: { select: { slug: true, id: true } } }
        });
        if (!existing) return { success: false, error: 'Variante no encontrada.' };

        const stockDelta = data.stock - existing.stock;

        await prisma.productVariant.update({
            where: { id: variantId },
            data: {
                sku: data.sku,
                stock: data.stock,
                price: data.price,
                is_active: data.is_active
            }
        });

        // Si el admin ajustó stock manualmente, registrarlo. Diferenciamos
        // RESTOCK (incremento, ej. recepción de mercancía) de ADJUSTMENT
        // (decremento, ej. corrección por inventario perdido).
        if (stockDelta !== 0) {
            await recordStockMovement({
                variant_id: variantId,
                quantity: stockDelta,
                reason: stockDelta > 0 ? 'RESTOCK' : 'ADJUSTMENT',
                note: 'Ajuste manual desde admin',
                user_id: session.user.id
            });
        }
        await auditLog({
            action: 'variant.update',
            entity_type: 'ProductVariant',
            entity_id: variantId,
            metadata: {
                product_id: existing.products.id,
                sku: data.sku,
                stock_before: existing.stock,
                stock_after: data.stock
            }
        });

        revalidatePath(`/[locale]/admin/products/${existing.products.id}/edit`, 'page');
        revalidatePath(`/[locale]/product/${existing.products.slug}`, 'page');
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        if (error?.code === 'P2002') return { success: false, error: 'Ya existe una variante con ese SKU.' };
        return { success: false, error: error?.message || 'No se pudo actualizar la variante.' };
    }
}

export async function deleteVariant(variantId: string) {
    try {
        await requireAdmin();

        // No permitimos borrar la última variante porque el checkout depende
        // de que haya al menos una para resolver el producto.
        const existing = await prisma.productVariant.findUnique({
            where: { id: variantId },
            include: { products: { select: { id: true, slug: true } } }
        });
        if (!existing) return { success: false, error: 'Variante no encontrada.' };

        const totalForProduct = await prisma.productVariant.count({
            where: { product_id: existing.product_id }
        });
        if (totalForProduct <= 1) {
            return { success: false, error: 'No se puede eliminar la única variante del producto.' };
        }

        await prisma.productVariant.delete({ where: { id: variantId } });

        revalidatePath(`/[locale]/admin/products/${existing.products.id}/edit`, 'page');
        revalidatePath(`/[locale]/product/${existing.products.slug}`, 'page');
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        if (error?.code === 'P2003') {
            return { success: false, error: 'La variante tiene pedidos asociados; desactívala en su lugar.' };
        }
        return { success: false, error: error?.message || 'No se pudo eliminar la variante.' };
    }
}

export async function updateProductRelations(
    productId: string,
    crossSellIds: string[],
    upSellIds: string[]
) {
    try {
        await requireAdmin();
        // Delete all existing relations from this product first
        await prisma.relatedProduct.deleteMany({
            where: { product_id: productId }
        });

        const newRelations = [];

        // Prepare Cross-Sells
        for (const relatedId of crossSellIds) {
            newRelations.push({
                product_id: productId,
                related_product_id: relatedId,
                relation_type: 'CROSS_SELL' as const
            });
        }

        // Prepare Up-Sells
        for (const relatedId of upSellIds) {
            newRelations.push({
                product_id: productId,
                related_product_id: relatedId,
                relation_type: 'UP_SELL' as const
            });
        }

        // Insert new relations
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
