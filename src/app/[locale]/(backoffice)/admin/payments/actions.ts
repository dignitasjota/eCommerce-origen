'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { auditLog } from '@/lib/audit';

export async function createPaymentMethod(formData: FormData) {
    await requireAdmin(['ADMIN']);
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const isActive = formData.get('is_active') === 'true';
    const id = crypto.randomUUID();

    await prisma.paymentMethod.create({
        data: {
            id,
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

    await auditLog({ action: 'payment_method.create', entity_type: 'PaymentMethod', entity_id: id, metadata: { type, name } });
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

    await auditLog({ action: 'payment_method.update', entity_type: 'PaymentMethod', entity_id: id, metadata: { type, name } });
    revalidatePath('/[locale]/admin/payments', 'page');
}

export async function deletePaymentMethod(id: string) {
    await requireAdmin(['ADMIN']);
    await prisma.paymentMethod.delete({
        where: { id }
    });
    await auditLog({ action: 'payment_method.delete', entity_type: 'PaymentMethod', entity_id: id });
    revalidatePath('/[locale]/admin/payments', 'page');
}
