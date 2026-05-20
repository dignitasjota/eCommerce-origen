import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getNewsletterConfirmEmailHtml } from '@/lib/emails/newsletter-confirm';
import { rateLimit } from '@/lib/rate-limit';
import { newsletterSubscribeSchema } from '@/lib/schemas';

/**
 * Newsletter — alta con doble opt-in.
 *
 * Por privacidad:
 *   - SIEMPRE devolvemos el mismo mensaje "te hemos enviado un correo" para
 *     evitar que un atacante pueda enumerar emails ya suscritos.
 *   - Si el email ya está confirmado, no enviamos nada.
 *   - Si está pendiente de confirmar, regeneramos token y reenviamos.
 *   - Token aleatorio de 32 bytes (256 bits) en hex → 64 chars. Inviable de
 *     fuerza bruta y nunca se persiste con HMAC porque no necesitamos
 *     verificarlo offline: comparamos directamente con la columna unique.
 */
export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'newsletter', max: 5, windowMs: 10 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = newsletterSubscribeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos inválidos.' },
                { status: 400 }
            );
        }
        const rawEmail = parsed.data.email;
        const locale = parsed.data.locale ?? 'es';

        const existing = await prisma.subscriber.findUnique({ where: { email: rawEmail } });

        // Mensaje genérico: nunca revelamos si ya estaba suscrito.
        const genericResponse = NextResponse.json({
            success: true,
            message: 'Te hemos enviado un correo para confirmar la suscripción.'
        });

        if (existing?.confirmed_at) {
            // Ya confirmado: no enviamos nada (silencioso) pero respondemos OK.
            return genericResponse;
        }

        const token = randomBytes(32).toString('hex');

        if (existing) {
            await prisma.subscriber.update({
                where: { id: existing.id },
                data: { confirm_token: token, locale, unsubscribed_at: null }
            });
        } else {
            await prisma.subscriber.create({
                data: { email: rawEmail, locale, confirm_token: token }
            });
        }

        // Configuración del sitio (siteName) para personalizar la plantilla.
        const siteSetting = await prisma.siteSetting.findUnique({ where: { key: 'site_name' } });
        const siteName = siteSetting?.value || 'eShop';

        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;
        const confirmUrl = `${baseUrl}/api/storefront/newsletter/confirm?token=${token}`;

        try {
            await sendEmail({
                to: rawEmail,
                subject: `Confirma tu suscripción a ${siteName}`,
                html: getNewsletterConfirmEmailHtml(confirmUrl, siteName)
            });
        } catch (e) {
            console.error('[newsletter] error enviando confirmación:', e);
            // Aunque falle el correo no devolvemos error al usuario para no
            // dar señal de existencia/no-existencia: ya hemos persistido el
            // intento y el job nocturno (futuro) puede reenviar.
        }

        return genericResponse;
    } catch (e: any) {
        console.error('[newsletter] error inesperado:', e);
        return NextResponse.json({ error: 'No se pudo procesar la solicitud.' }, { status: 500 });
    }
}
