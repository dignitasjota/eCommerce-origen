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
};

export default withNextIntl(nextConfig);
