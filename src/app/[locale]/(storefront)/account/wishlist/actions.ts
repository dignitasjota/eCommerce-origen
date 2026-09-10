'use server';

import crypto from 'crypto';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

type ShareResult = { success: true; token: string } | { success: false; error: string };
type RevokeResult = { success: true } | { success: false; error: string };

/**
 * Devuelve el token existente o genera uno nuevo (256 bits, igual criterio
 * que `Subscriber.confirm_token`) si el usuario nunca ha compartido su
 * wishlist. Idempotente: no rota un token ya existente — así un enlace ya
 * compartido sigue funcionando aunque el usuario vuelva a pulsar "Compartir".
 */
export async function generateWishlistShareLink(): Promise<ShareResult> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Sesión no válida.' };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { wishlist_share_token: true }
        });
        if (user?.wishlist_share_token) return { success: true, token: user.wishlist_share_token };

        const token = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
            where: { id: session.user.id },
            data: { wishlist_share_token: token }
        });
        revalidatePath('/es/account/wishlist');
        return { success: true, token };
    } catch {
        return { success: false, error: 'Error al generar el enlace para compartir.' };
    }
}

/** Desactiva el enlace compartido: el token deja de resolver a cualquier lista. */
export async function revokeWishlistShareLink(): Promise<RevokeResult> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Sesión no válida.' };

        await prisma.user.update({
            where: { id: session.user.id },
            data: { wishlist_share_token: null }
        });
        revalidatePath('/es/account/wishlist');
        return { success: true };
    } catch {
        return { success: false, error: 'Error al desactivar el enlace.' };
    }
}
