import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getPasswordResetEmailHtml } from '@/lib/emails/password-reset';
import { rateLimit } from '@/lib/rate-limit';
import { signResetToken } from '@/lib/password-reset-token';
import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { getPublicAppUrl } from '@/lib/app-url';

const GENERIC_RESPONSE = { success: true, message: 'El correo ha sido enviado si la cuenta existe.' };

export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'forgot-password', max: 3, windowMs: 15 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        // Schema compartido: trim + minúsculas. Antes se buscaba el email tal
        // cual llegaba, y como el registro lo guarda en minúsculas, quien
        // escribiera "Ana@Mail.com" nunca recibía el correo.
        const body = await req.json().catch(() => null);
        const parsed = forgotPasswordSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Email requerido' }, { status: 400 });
        }
        const { email } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });

        // Misma respuesta exista o no la cuenta (evita enumeración). Las
        // cuentas desactivadas tampoco reciben enlace.
        if (!user || !user.is_active) {
            return NextResponse.json(GENERIC_RESPONSE);
        }

        // Token que expira en 1 hora, vinculado al prefijo del hash actual
        // para que, si cambia la contraseña, el token anterior quede inválido.
        const token = signResetToken({
            id: user.id,
            email: user.email,
            hashPrefix: user.password_hash ? user.password_hash.slice(0, 10) : '',
            exp: Date.now() + 3600000
        });

        // URL pública desde configuración, NUNCA desde la cabecera Host.
        const resetUrl = `${getPublicAppUrl(req)}/auth/reset-password?token=${token}`;

        await sendEmail({
            to: user.email,
            subject: 'Recuperación de Contraseña - eShop',
            html: getPasswordResetEmailHtml(user.name || 'Cliente', resetUrl)
        });

        return NextResponse.json(GENERIC_RESPONSE);
    } catch (error: unknown) {
        console.error('Forgot Password error:', error);
        return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
    }
}
