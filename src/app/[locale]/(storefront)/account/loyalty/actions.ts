'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redeemPointsForCoupon } from '@/lib/loyalty';
import { revalidatePath } from 'next/cache';

type RedeemResult = { success: true; code: string; discount: string } | { success: false; error: string };

export async function redeemPoints(formData: FormData): Promise<RedeemResult> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Sesión no válida.' };

        const pointsRaw = formData.get('points');
        const points = typeof pointsRaw === 'string' ? parseInt(pointsRaw, 10) : NaN;
        if (!Number.isFinite(points) || points <= 0) {
            return { success: false, error: 'Introduce una cantidad de puntos válida.' };
        }

        const coupon = await redeemPointsForCoupon(prisma, session.user.id, points);

        revalidatePath('/es/account/loyalty');
        return { success: true, code: coupon.code, discount: Number(coupon.discount_value).toFixed(2) };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Error al canjear los puntos.' };
    }
}
