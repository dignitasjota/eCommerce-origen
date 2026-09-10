import type { MetadataRoute } from 'next';
import prisma from '@/lib/db';

// Sin esto, Next prerenderiza el manifest en build time y un cambio de
// site_name/site_favicon/site_logo desde /admin/settings no se reflejaría
// hasta el próximo despliegue — rompería la promesa del resto de la app de
// que los ajustes de marca se aplican de inmediato (mismo motivo que
// `dynamic = 'force-dynamic'` en /admin/orders o el endpoint de búsqueda).
export const dynamic = 'force-dynamic';

/**
 * Plantilla multi-instancia: el nombre/iconos del manifest salen de
 * `SiteSettings` (mismas claves que ya usa `generateMetadata` en
 * `[locale]/layout.tsx` para el favicon) en vez de estar hardcodeados —
 * cada cliente ve su propia marca al instalar la PWA.
 */

function guessMimeType(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        default:
            return 'image/png';
    }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    const settingsList = await prisma.siteSetting.findMany({
        where: { key: { in: ['site_name', 'site_favicon', 'site_logo'] } }
    });
    const settings = settingsList.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    const siteName = settings['site_name'] || 'eShop';

    // Tamaño real desconocido (son imágenes subidas libremente por el
    // admin) — `sizes: 'any'` es la declaración honesta para un icono
    // raster sin dimensiones garantizadas.
    const icons: MetadataRoute.Manifest['icons'] = [];
    if (settings['site_logo']) {
        icons.push({ src: settings['site_logo'], sizes: 'any', type: guessMimeType(settings['site_logo']), purpose: 'any' });
    }
    if (settings['site_favicon']) {
        icons.push({ src: settings['site_favicon'], sizes: 'any', type: guessMimeType(settings['site_favicon']) });
    }
    if (icons.length === 0) {
        icons.push({ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' });
    }

    return {
        name: siteName,
        short_name: siteName,
        description: `Tienda online de ${siteName}`,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons
    };
}
