'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function createProduct(formData: FormData) {
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;

    // Convert price
    const price = parseFloat(priceStr);
    if (isNaN(price)) throw new Error('Precio inválido');

    // Default to 'es' locale, assuming single localized dashboard for now
    const locale = 'es';

    await prisma.product.create({
        data: {
            id: crypto.randomUUID(),
            slug,
            sku,
            price,
            is_active: isActive,
            product_translations: {
                create: {
                    id: crypto.randomUUID(),
                    locale,
                    name
                }
            }
        }
    });

    revalidatePath('/[locale]/admin/products', 'page');
}

export async function updateProduct(id: string, formData: FormData) {
    const slug = formData.get('slug') as string;
    const sku = formData.get('sku') as string;
    const priceStr = formData.get('price') as string;
    const isActive = formData.get('is_active') === 'true';
    const name = formData.get('name') as string;

    const price = parseFloat(priceStr);
    if (isNaN(price)) throw new Error('Precio inválido');

    const locale = 'es'; // Assuming 'es'

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
                name
            },
            update: {
                name
            }
        })
    ]);

    revalidatePath('/[locale]/admin/products', 'page');
}

export async function deleteProduct(id: string) {
    await prisma.product.delete({
        where: { id }
    });
    revalidatePath('/[locale]/admin/products', 'page');
}
