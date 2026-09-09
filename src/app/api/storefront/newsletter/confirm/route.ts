import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Endpoint que cierra el doble opt-in. El usuario llega aquí desde el botón
 * de su correo. Si el token coincide marcamos `confirmed_at` y limpiamos el
 * token (ya consumido). Redirigimos a una página visual de éxito/error.
 */
export const dynamic = 'force-dynamic';

// Sin TTL, un confirm_token filtrado (logs, referrer, buzón comprometido)
// seguía siendo válido indefinidamente. 7 días es margen de sobra para que
// un suscriptor real haga clic en el email de confirmación.
const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;

export async function GET(req: Request) {
    const limit = rateLimit(req, { bucket: 'newsletter-confirm', max: 30, windowMs: 60_000 });
    if (!limit.ok) {
        return NextResponse.json(
            { error: 'Demasiadas peticiones.' },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const token = (searchParams.get('token') || '').trim();
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;

    if (!token || token.length !== 64) {
        return NextResponse.redirect(`${baseUrl}/?newsletter=invalid`, 302);
    }

    const subscriber = await prisma.subscriber.findUnique({ where: { confirm_token: token } });
    if (!subscriber) {
        return NextResponse.redirect(`${baseUrl}/?newsletter=invalid`, 302);
    }

    if (subscriber.confirmed_at) {
        return NextResponse.redirect(`${baseUrl}/?newsletter=already`, 302);
    }

    if (Date.now() - subscriber.created_at.getTime() > CONFIRM_TOKEN_TTL_MS) {
        return NextResponse.redirect(`${baseUrl}/?newsletter=invalid`, 302);
    }

    await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { confirmed_at: new Date(), confirm_token: null }
    });

    return NextResponse.redirect(`${baseUrl}/?newsletter=confirmed`, 302);
}
