'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const MAX_ADDRESSES_PER_USER = 20;

const addressSchema = z.object({
    firstName: z.string().trim().min(1, 'Nombre requerido').max(100),
    lastName: z.string().trim().min(1, 'Apellidos requeridos').max(100),
    address1: z.string().trim().min(1, 'Dirección requerida').max(255),
    address2: z.string().trim().max(255).optional().nullable(),
    city: z.string().trim().min(1, 'Ciudad requerida').max(100),
    state: z.string().trim().max(100).optional().nullable(),
    postalCode: z.string().trim().min(1, 'Código postal requerido').max(20),
    country: z.string().trim().min(1, 'País requerido').max(100),
    phone: z.string().trim().max(50).optional().nullable(),
    taxId: z.string().trim().max(32).optional().nullable(),
    isDefault: z.boolean().optional()
});

async function requireSessionUserId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Sesión no válida.');
    return session.user.id;
}

function parseAddressForm(formData: FormData) {
    return addressSchema.safeParse({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        address1: formData.get('address1'),
        address2: (formData.get('address2') as string) || undefined,
        city: formData.get('city'),
        state: (formData.get('state') as string) || undefined,
        postalCode: formData.get('postalCode'),
        country: formData.get('country'),
        phone: (formData.get('phone') as string) || undefined,
        taxId: (formData.get('taxId') as string) || undefined,
        isDefault: formData.get('isDefault') === 'true'
    });
}

export async function createAddress(formData: FormData) {
    try {
        const userId = await requireSessionUserId();
        const parsed = parseAddressForm(formData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos.' };
        }
        const d = parsed.data;

        const existingCount = await prisma.address.count({ where: { user_id: userId } });
        if (existingCount >= MAX_ADDRESSES_PER_USER) {
            return { success: false, error: `Máximo ${MAX_ADDRESSES_PER_USER} direcciones guardadas.` };
        }

        await prisma.$transaction(async (tx) => {
            if (d.isDefault || existingCount === 0) {
                // La primera dirección de un usuario se marca predeterminada
                // automáticamente aunque no se haya marcado el checkbox.
                await tx.address.updateMany({ where: { user_id: userId }, data: { is_default: false } });
            }
            await tx.address.create({
                data: {
                    user_id: userId,
                    first_name: d.firstName,
                    last_name: d.lastName,
                    address1: d.address1,
                    address2: d.address2 || null,
                    city: d.city,
                    state: d.state || null,
                    postal_code: d.postalCode,
                    country: d.country,
                    phone: d.phone || null,
                    tax_id: d.taxId || null,
                    is_default: d.isDefault || existingCount === 0
                }
            });
        });

        revalidatePath('/[locale]/account/addresses', 'page');
        return { success: true };
    } catch (e) {
        console.error('[account] createAddress error:', e);
        return { success: false, error: e instanceof Error ? e.message : 'Error al crear la dirección.' };
    }
}

export async function updateAddress(addressId: string, formData: FormData) {
    try {
        const userId = await requireSessionUserId();
        const parsed = parseAddressForm(formData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos.' };
        }
        const d = parsed.data;

        const updated = await prisma.$transaction(async (tx) => {
            if (d.isDefault) {
                await tx.address.updateMany({ where: { user_id: userId }, data: { is_default: false } });
            }
            // Guard de ownership: el `where` exige que la dirección sea del
            // usuario de la sesión — sin esto, cualquier usuario autenticado
            // podría editar la dirección de otro cambiando el id en el form.
            return tx.address.updateMany({
                where: { id: addressId, user_id: userId },
                data: {
                    first_name: d.firstName,
                    last_name: d.lastName,
                    address1: d.address1,
                    address2: d.address2 || null,
                    city: d.city,
                    state: d.state || null,
                    postal_code: d.postalCode,
                    country: d.country,
                    phone: d.phone || null,
                    tax_id: d.taxId || null,
                    is_default: d.isDefault
                }
            });
        });
        if (updated.count !== 1) {
            return { success: false, error: 'Dirección no encontrada.' };
        }

        revalidatePath('/[locale]/account/addresses', 'page');
        return { success: true };
    } catch (e) {
        console.error('[account] updateAddress error:', e);
        return { success: false, error: e instanceof Error ? e.message : 'Error al actualizar la dirección.' };
    }
}

export async function deleteAddress(addressId: string) {
    try {
        const userId = await requireSessionUserId();
        // Guard de ownership en el propio `where` del delete.
        const result = await prisma.address.deleteMany({
            where: { id: addressId, user_id: userId }
        });
        if (result.count !== 1) {
            return { success: false, error: 'Dirección no encontrada.' };
        }

        revalidatePath('/[locale]/account/addresses', 'page');
        return { success: true };
    } catch (e) {
        console.error('[account] deleteAddress error:', e);
        // Order.shipping_address_id/billing_address_id -> Address es RESTRICT
        // (a propósito: no se puede dejar huérfano el histórico de un pedido).
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
            return { success: false, error: 'No se puede eliminar: esta dirección está asociada a un pedido existente.' };
        }
        return { success: false, error: 'Error al eliminar la dirección.' };
    }
}

export async function setDefaultAddress(addressId: string) {
    try {
        const userId = await requireSessionUserId();

        await prisma.$transaction(async (tx) => {
            await tx.address.updateMany({ where: { user_id: userId }, data: { is_default: false } });
            // Guard de ownership: si el id no es del usuario, count !== 1 y
            // Prisma hace rollback de la transacción entera (incluido el
            // updateMany de arriba, que si no se abortase dejaría a un
            // usuario sin ninguna dirección predeterminada).
            const claim = await tx.address.updateMany({
                where: { id: addressId, user_id: userId },
                data: { is_default: true }
            });
            if (claim.count !== 1) throw new Error('Dirección no encontrada.');
        });

        revalidatePath('/[locale]/account/addresses', 'page');
        return { success: true };
    } catch (e) {
        console.error('[account] setDefaultAddress error:', e);
        return { success: false, error: e instanceof Error ? e.message : 'Error al marcar como predeterminada.' };
    }
}
