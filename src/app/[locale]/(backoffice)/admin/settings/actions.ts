'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateSettings(formData: FormData) {
    try {
        const settingsToUpdate = [];

        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                settingsToUpdate.push({
                    key,
                    value,
                    type: value === 'true' || value === 'false' ? 'boolean' : 'string',
                });
            }
        }

        // Upsert all settings
        await prisma.$transaction(
            settingsToUpdate.map((setting) =>
                prisma.siteSetting.upsert({
                    where: { key: setting.key },
                    update: { value: setting.value },
                    create: { key: setting.key, value: setting.value, type: setting.type },
                })
            )
        );

        // Revalidate frontend paths so changes take effect immediately
        revalidatePath('/', 'layout');

        return { success: true, message: 'Ajustes guardados correctamente.' };
    } catch (error: any) {
        console.error('Error updating settings:', error);
        return { success: false, error: error.message || 'Error al guardar los ajustes.' };
    }
}
