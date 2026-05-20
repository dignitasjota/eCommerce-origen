'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';

export async function createPaymentMethod(formData: FormData) {
    await requireAdmin(['ADMIN']);
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const isActive = formData.get('is_active') === 'true';

    await prisma.paymentMethod.create({
        data: {
            id: crypto.randomUUID(),
            type,
            is_active: isActive,
            payment_method_translations: {
                create: {
                    id: crypto.randomUUID(),
                    locale: 'es',
                    name,
                    description
                }
            }
        }
    });

    revalidatePath('/[locale]/admin/payments', 'page');
}

export async function updatePaymentMethod(id: string, formData: FormData) {
    await requireAdmin(['ADMIN']);
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const isActive = formData.get('is_active') === 'true';

    await prisma.$transaction([
        prisma.paymentMethod.update({
            where: { id },
            data: {
                type,
                is_active: isActive
            }
        }),
        prisma.paymentMethodTranslation.upsert({
            where: {
                payment_method_id_locale: {
                    payment_method_id: id,
                    locale: 'es'
                }
            },
            create: {
                id: crypto.randomUUID(),
                payment_method_id: id,
                locale: 'es',
                name,
                description
            },
            update: {
                name,
                description
            }
        })
    ]);

    revalidatePath('/[locale]/admin/payments', 'page');
}

export async function deletePaymentMethod(id: string) {
    await requireAdmin(['ADMIN']);
    await prisma.paymentMethod.delete({
        where: { id }
    });
    revalidatePath('/[locale]/admin/payments', 'page');
}
