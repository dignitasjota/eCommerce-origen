import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/admin/',         // Backend Privado
                '/account/',       // Info Cuenta
                '/checkout/',      // Datos Transaccionales
                '/api/',           // Endpoints Rest
                '/auth/',          // Autenticación (evitar indexar links de rescate o login crudo)
                '/*/admin/',
                '/*/account/',
                '/*/checkout/',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
