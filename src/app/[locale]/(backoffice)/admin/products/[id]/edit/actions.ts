'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateProductRelations(
    productId: string,
    crossSellIds: string[],
    upSellIds: string[]
) {
    try {
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
        console.error("Error updating product relations:", error);
        return { success: false, error: 'Hubo un error guardando las relaciones' };
    }
}
