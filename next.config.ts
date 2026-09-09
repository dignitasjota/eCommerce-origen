import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Salida standalone: la build incluye sólo lo necesario para `node server.js`,
  // sin node_modules completo. Reduce la imagen Docker de ~1.2GB a ~250MB.
  output: 'standalone',
  experimental: {
    serverActions: {
      // Default de Next es 1MB; ImageUploader promete hasta 8MB por imagen
      // (ver src/components/backoffice/ImageUploader.tsx maxSizeMB) y la
      // galería de productos permite subir varias a la vez en un mismo submit.
      bodySizeLimit: '32mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Fallback: si el middleware no reescribe la URL para añadir el locale,
        // este rewrite a nivel de config lo hace. Necesario para Plesk/Passenger
        // donde NextResponse.rewrite() del middleware no funciona correctamente.
        {
          source: '/:path((?!es|en|api|_next|_vercel|uploads|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
          destination: '/es/:path',
        },
      ],
    };
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    // 'unsafe-inline' en script-src: GA4/Meta Pixel (src/components/storefront/
    // AnalyticsScripts.tsx) se inyectan como <script> inline vía next/script,
    // no como archivo externo — sin 'unsafe-inline' dejarían de ejecutarse.
    // Endurecerlo requeriría CSP con nonce (soportado por Next, pero exige
    // verificar en vivo que GA4/Meta Pixel lo siguen usando correctamente:
    // fuera de alcance de este fix). 'unsafe-eval' SOLO en dev: lo necesita
    // el HMR de Turbopack, no se envía en producción.
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      isDev ? "'unsafe-eval'" : '',
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
    ]
      .filter(Boolean)
      .join(' ');

    // fonts.googleapis.com: @import de Inter en globals.css. img-src con
    // https: amplio porque el admin puede apuntar imágenes de producto a
    // cualquier host externo (next.config images.remotePatterns hostname:'**').
    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.doubleclick.net https://connect.facebook.net https://www.facebook.com https://*.sentry.io" +
        (isDev ? ' ws: http://localhost:*' : ''),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // Reemplazado por `frame-ancestors` de la CSP en navegadores que la
          // soportan, pero se mantiene para los que sólo respetan XFO.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Ignorado por el navegador si la conexión no es HTTPS — seguro
          // de enviar siempre, incluido en despliegues locales sobre HTTP.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
