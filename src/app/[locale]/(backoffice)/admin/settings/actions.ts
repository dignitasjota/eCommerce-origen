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
            if (typeof value === 'string' && !key.startsWith('carousel_images_') && key !== 'home_carousel_images') {
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

        // Special handling for carousel images
        const currentImagesStr = formData.get('carousel_images_current') as string;
        let carouselImages: string[] = [];
        if (currentImagesStr) {
            try { carouselImages = JSON.parse(currentImagesStr); } catch (e) { }
        }

        const newImages = formData.getAll('carousel_images_new');
        for (const file of newImages) {
            if (file instanceof File && file.size > 0) {
                const ext = file.name.split('.').pop() || 'png';
                const filename = `carousel_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const filepath = join(uploadDir, filename);
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(filepath, buffer);
                carouselImages.push(`/uploads/${filename}`);
            }
        }

        if (formData.has('carousel_images_current') || newImages.length > 0) {
            settingsToUpdate.push({
                key: 'home_carousel_images',
                value: JSON.stringify(carouselImages),
                type: 'json'
            });
        }

        const carouselInterval = formData.get('home_carousel_interval');
        if (carouselInterval && typeof carouselInterval === 'string') {
            settingsToUpdate.push({
                key: 'home_carousel_interval',
                value: carouselInterval,
                type: 'number'
            });
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
