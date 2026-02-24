'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function updateSettings(formData: FormData) {
    try {
        const settingsToUpdate = [];

        const uploadDir = join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true }).catch(() => { }); // Ensure exists

        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                settingsToUpdate.push({
                    key,
                    value,
                    type: value === 'true' || value === 'false' ? 'boolean' : 'string',
                });
            } else if (value instanceof File && value.size > 0 && (key === 'site_logo' || key === 'site_favicon')) {
                // Extract extension
                const ext = value.name.split('.').pop() || 'png';
                const filename = `${key}_${Date.now()}.${ext}`;
                const filepath = join(uploadDir, filename);

                // Write file to public/uploads
                const buffer = Buffer.from(await value.arrayBuffer());
                await writeFile(filepath, buffer);

                // Add to database update array
                settingsToUpdate.push({
                    key,
                    value: `/uploads/${filename}`,
                    type: 'string',
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
