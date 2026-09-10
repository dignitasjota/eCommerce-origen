import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { routing } from '@/i18n/navigation';
import { ADMIN_ROLES, type AdminRole } from '@/lib/auth-roles';
import { AB_HERO_COOKIE } from '@/lib/ab-testing';

const intlMiddleware = createMiddleware(routing);

// localePrefix es 'as-needed': 'es' (default) se sirve sin prefijo, 'en' con
// /en/. Aceptamos ambas formas para 'es' (con y sin /es/ explícito) por si
// alguien navega directamente a la URL prefijada.
const ADMIN_PATH_RE = /^\/(?:es\/|en\/)?admin(?:\/|$)/;

export default async function middleware(request: NextRequest) {
    if (ADMIN_PATH_RE.test(request.nextUrl.pathname)) {
        const authorized = await isAuthorizedAdmin(request);
        if (!authorized) {
            // 'es' es el locale por defecto y no lleva prefijo (localePrefix:
            // 'as-needed') — construir '/es/auth/login' aquí sería una URL
            // no-canónica que luego next-intl tendría que resolver igual.
            const isEnglish = request.nextUrl.pathname.startsWith('/en/');
            const loginPath = isEnglish ? '/en/auth/login' : '/auth/login';
            const loginUrl = new URL(loginPath, request.url);
            loginUrl.searchParams.set(
                'callbackUrl',
                request.nextUrl.pathname + request.nextUrl.search
            );
            return NextResponse.redirect(loginUrl);
        }
    }

    // Nota histórica (CLAUDE.md §9.2/9.3): esto convertía cualquier rewrite
    // interno de next-intl en un redirect visible porque Plesk/Passenger no
    // soportaba `NextResponse.rewrite()`. El proyecto migró a Docker/
    // standalone (ver Dockerfile), donde el rewrite nativo funciona con
    // normalidad — mantener el hack forzaba un round-trip y un cambio de URL
    // visibles innecesarios en cada request sin prefijo de locale.
    const response = intlMiddleware(request);
    ensureAbHeroCookie(request, response);
    return response;
}

/**
 * Asigna la variante A/B del hero de home en la primera visita (50/50) y la
 * fija en cookie — así el mismo visitante ve siempre la misma variante en
 * toda su sesión, en vez de que cambie en cada recarga. Se asigna aquí (no
 * en el propio Server Component de home) porque un Server Component no
 * puede escribir cookies nuevas fuera de una Server Action/Route Handler.
 */
function ensureAbHeroCookie(request: NextRequest, response: NextResponse) {
    if (request.cookies.has(AB_HERO_COOKIE)) return;
    const variant = Math.random() < 0.5 ? 'A' : 'B';
    response.cookies.set(AB_HERO_COOKIE, variant, {
        maxAge: 60 * 60 * 24 * 90,
        path: '/',
        sameSite: 'lax'
    });
}

/**
 * Decodifica el JWT de sesión sin pasar por `auth()` (que arrastraría el
 * PrismaAdapter al bundle del middleware). Fail-safe: cualquier duda
 * (sin secreto configurado, token corrupto) deniega el acceso.
 */
async function isAuthorizedAdmin(request: NextRequest): Promise<boolean> {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return false;

    try {
        const token = await getToken({
            req: request,
            secret,
            secureCookie: isConfiguredForHttps(),
        });
        const role = token?.role as AdminRole | undefined;
        return !!role && ADMIN_ROLES.includes(role);
    } catch {
        return false;
    }
}

/**
 * NextAuth decide el nombre de cookie (con/sin prefijo `__Secure-`) según la
 * URL pública configurada, no según el protocolo con el que el middleware
 * recibe la petición internamente (detrás de un reverse proxy suele ser HTTP
 * plano aunque el sitio público sea HTTPS). Usamos la misma señal aquí para
 * que `getToken()` busque el nombre de cookie correcto.
 */
function isConfiguredForHttps(): boolean {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '';
    return url.startsWith('https://');
}

export const config = {
    matcher: [
        '/((?!api|_next|_vercel|.*\\..*).*)',
    ],
};
