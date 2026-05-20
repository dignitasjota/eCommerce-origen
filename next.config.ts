import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Salida standalone: la build incluye sólo lo necesario para `node server.js`,
  // sin node_modules completo. Reduce la imagen Docker de ~1.2GB a ~250MB.
  output: 'standalone',
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
