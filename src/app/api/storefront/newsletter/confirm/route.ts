import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Endpoint que cierra el doble opt-in. El usuario llega aquí desde el botón
 * de su correo. Si el token coincide marcamos `confirmed_at` y limpiamos el
 * token (ya consumido). Redirigimos a una página visual de éxito/error.
 */
export const dynamic = 'force-dynamic';

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

    await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { confirmed_at: new Date(), confirm_token: null }
    });

    return NextResponse.redirect(`${baseUrl}/?newsletter=confirmed`, 302);
}
