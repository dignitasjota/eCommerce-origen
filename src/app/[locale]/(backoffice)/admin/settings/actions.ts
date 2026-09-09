'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { saveUploadedImage } from '@/lib/uploads';

export async function updateSettings(formData: FormData) {
    try {
        await requireAdmin(['ADMIN']);
        const settingsToUpdate = [];

        const themesDir = join(process.cwd(), 'public', 'themes');
        await mkdir(themesDir, { recursive: true }).catch(() => { });

        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string' && !key.startsWith('carousel_images_') && key !== 'home_carousel_images' && key !== 'theme_file') {
                settingsToUpdate.push({
                    key,
                    value,
                    type: value === 'true' || value === 'false' ? 'boolean' : 'string',
                });
            } else if (value instanceof File && value.size > 0) {
                if (key === 'site_logo' || key === 'site_favicon') {
                    const url = await saveUploadedImage(value, { prefix: key });
                    settingsToUpdate.push({
                        key,
                        value: url,
                        type: 'string',
                    });
                } else if (key === 'theme_file') {
                    // It's a theme file, save it to public/themes
                    let themeName = value.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
                    if (!themeName.endsWith('.css')) themeName += '.css';
                    const filepath = join(themesDir, themeName);
                    const buffer = Buffer.from(await value.arrayBuffer());
                    await writeFile(filepath, buffer);

                    // Also automatically set this as the active theme
                    settingsToUpdate.push({
                        key: 'storefront_theme',
                        value: themeName.replace('.css', ''),
                        type: 'string'
                    });
                }
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
                const url = await saveUploadedImage(file, { prefix: 'carousel' });
                carouselImages.push(url);
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
        revalidatePath('/[locale]/admin/settings', 'page');
        revalidatePath('/[locale]', 'layout');

        // Auditoría: log con las claves modificadas (no los valores: pueden ser
        // secretos como stripe_secret_key).
        await auditLog({
            action: 'settings.update',
            entity_type: 'SiteSettings',
            metadata: { keys: settingsToUpdate.map((s) => s.key) }
        });

        return { success: true, message: 'Ajustes guardados correctamente.' };
    } catch (error: any) {
        if (error instanceof AuthorizationError) {
            return { success: false, error: error.message };
        }
        console.error('Error updating settings:', error);
        return { success: false, error: error.message || 'Error al guardar los ajustes.' };
    }
}
