import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/navigation';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const response = intlMiddleware(request);

    // Plesk/Passenger no soporta NextResponse.rewrite().
    // Si el middleware de next-intl devuelve un rewrite, lo convertimos en redirect.
    const rewriteUrl = response.headers.get('x-middleware-rewrite');
    if (rewriteUrl) {
        return NextResponse.redirect(new URL(rewriteUrl));
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next|_vercel|.*\\..*).*)',
    ],
};
