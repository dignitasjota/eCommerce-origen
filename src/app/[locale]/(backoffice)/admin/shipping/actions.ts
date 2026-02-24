'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createShippingMethod(formData: FormData) {
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);
    const freeAboveRaw = formData.get('free_above') as string;
    const minWeightRaw = formData.get('min_weight') as string;
    const maxWeightRaw = formData.get('max_weight') as string;
    const estimatedDays = formData.get('estimated_days') as string;
    const isActive = formData.get('is_active') === 'true';

    const freeAbove = freeAboveRaw ? parseFloat(freeAboveRaw) : null;
    const minWeight = minWeightRaw ? parseFloat(minWeightRaw) : null;
    const maxWeight = maxWeightRaw ? parseFloat(maxWeightRaw) : null;

    await prisma.shippingMethod.create({
        data: {
            price,
            free_above: freeAbove,
            min_weight: minWeight,
            max_weight: maxWeight,
            estimated_days: estimatedDays || null,
            is_active: isActive,
            shipping_method_translations: {
                create: {
                    locale: 'es',
                    name,
                }
            }
        }
    });

    revalidatePath('/es/admin/shipping');
}

export async function updateShippingMethod(id: string, formData: FormData) {
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);
    const freeAboveRaw = formData.get('free_above') as string;
    const minWeightRaw = formData.get('min_weight') as string;
    const maxWeightRaw = formData.get('max_weight') as string;
    const estimatedDays = formData.get('estimated_days') as string;
    const isActive = formData.get('is_active') === 'true';

    const freeAbove = freeAboveRaw ? parseFloat(freeAboveRaw) : null;
    const minWeight = minWeightRaw ? parseFloat(minWeightRaw) : null;
    const maxWeight = maxWeightRaw ? parseFloat(maxWeightRaw) : null;

    await prisma.$transaction([
        prisma.shippingMethod.update({
            where: { id },
            data: {
                price,
                free_above: freeAbove,
                min_weight: minWeight,
                max_weight: maxWeight,
                estimated_days: estimatedDays || null,
                is_active: isActive,
            }
        }),
        prisma.shippingMethodTranslation.upsert({
            where: {
                shipping_method_id_locale: {
                    shipping_method_id: id,
                    locale: 'es'
                }
            },
            update: {
                name
            },
            create: {
                shipping_method_id: id,
                locale: 'es',
                name
            }
        })
    ]);

    revalidatePath('/es/admin/shipping');
}

export async function deleteShippingMethod(id: string) {
    try {
        await prisma.shippingMethod.delete({
            where: { id }
        });
        revalidatePath('/es/admin/shipping');
    } catch (e: any) {
        throw new Error('No se pudo eliminar el método de envío. Posiblemente esté siendo usado en algún pedido.');
    }
}
