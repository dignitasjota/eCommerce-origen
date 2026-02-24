'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createCoupon(formData: FormData) {
    const code = formData.get('code') as string;
    const discountType = formData.get('discount_type') as 'PERCENTAGE' | 'FIXED';
    const discountValue = parseFloat(formData.get('discount_value') as string);
    const minPurchaseRaw = formData.get('min_purchase') as string;
    const maxUsesRaw = formData.get('max_uses') as string;
    const isActive = formData.get('is_active') === 'true';
    const expiresAtRaw = formData.get('expires_at') as string;

    const minPurchase = minPurchaseRaw ? parseFloat(minPurchaseRaw) : null;
    const maxUses = maxUsesRaw ? parseInt(maxUsesRaw) : null;
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

    try {
        await prisma.coupon.create({
            data: {
                code: code.toUpperCase(),
                discount_type: discountType,
                discount_value: discountValue,
                min_purchase: minPurchase,
                max_uses: maxUses,
                is_active: isActive,
                expires_at: expiresAt,
            }
        });
        revalidatePath('/es/admin/coupons');
    } catch (e: any) {
        if (e.code === 'P2002') {
            throw new Error('Ya existe un cupón con este código.');
        }
        throw new Error('Error al crear el cupón.');
    }
}

export async function updateCoupon(id: string, formData: FormData) {
    const code = formData.get('code') as string;
    const discountType = formData.get('discount_type') as 'PERCENTAGE' | 'FIXED';
    const discountValue = parseFloat(formData.get('discount_value') as string);
    const minPurchaseRaw = formData.get('min_purchase') as string;
    const maxUsesRaw = formData.get('max_uses') as string;
    const isActive = formData.get('is_active') === 'true';
    const expiresAtRaw = formData.get('expires_at') as string;

    const minPurchase = minPurchaseRaw ? parseFloat(minPurchaseRaw) : null;
    const maxUses = maxUsesRaw ? parseInt(maxUsesRaw) : null;
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

    try {
        await prisma.coupon.update({
            where: { id },
            data: {
                code: code.toUpperCase(),
                discount_type: discountType,
                discount_value: discountValue,
                min_purchase: minPurchase,
                max_uses: maxUses,
                is_active: isActive,
                expires_at: expiresAt,
            }
        });
        revalidatePath('/es/admin/coupons');
    } catch (e: any) {
        if (e.code === 'P2002') {
            throw new Error('Ya existe un cupón con este código.');
        }
        throw new Error('Error al actualizar el cupón.');
    }
}

export async function deleteCoupon(id: string) {
    try {
        await prisma.coupon.delete({
            where: { id }
        });
        revalidatePath('/es/admin/coupons');
    } catch (e) {
        throw new Error('Error al eliminar el cupón.');
    }
}
