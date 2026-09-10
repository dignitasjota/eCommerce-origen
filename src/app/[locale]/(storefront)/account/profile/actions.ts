'use server';

import { z } from 'zod';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const updateProfileSchema = z.object({
    name: z.string().trim().min(2, 'Nombre demasiado corto').max(100),
    phone: z.string().trim().max(50).optional().nullable()
});

/**
 * El `user_id` sale SIEMPRE de la sesión del servidor, nunca de un valor
 * enviado por el cliente — imposible editar el perfil de otro usuario aunque
 * se manipule el FormData.
 */
export async function updateProfile(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'Sesión no válida.' };
        }

        const parsed = updateProfileSchema.safeParse({
            name: formData.get('name'),
            phone: (formData.get('phone') as string) || undefined
        });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos.' };
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { name: parsed.data.name, phone: parsed.data.phone || null }
        });

        revalidatePath('/[locale]/account/profile', 'page');
        return { success: true };
    } catch (e) {
        console.error('[account] updateProfile error:', e);
        return { success: false, error: 'Error al actualizar el perfil.' };
    }
}
