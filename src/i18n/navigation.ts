import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    locales: ['es', 'en'],
    defaultLocale: 'es',
    // 'as-needed': el locale por defecto (es) se sirve SIN prefijo (/productos),
    // sólo 'en' lleva prefijo (/en/products). Es el modo que asumen el resto de
    // piezas del sistema: el rewrite de next.config.ts, el sitemap
    // (src/app/sitemap.ts) y el hreflang (src/app/[locale]/layout.tsx) ya
    // generaban URLs de "es" sin prefijo — con 'always' next-intl redirigía
    // (307) cualquier visita a esas URLs "canónicas" hacia /es/…, lo que las
    // invalidaba como canónicas de cara a buscadores.
    localePrefix: 'as-needed',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
