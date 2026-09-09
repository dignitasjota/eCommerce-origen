import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rate-limit';
import { verifyResetToken } from '@/lib/password-reset-token';
import { resetPasswordSchema } from '@/lib/schemas/auth';

export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'reset-password', max: 5, windowMs: 15 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await req.json().catch(() => null);
        // Antes este endpoint validaba a mano (`password.length < 6`) en vez
        // de usar `resetPasswordSchema` (mínimo 8, igual que el registro) —
        // permitía bajar la política de complejidad de una cuenta existente
        // usando el flujo de "olvidé mi contraseña".
        const parsed = resetPasswordSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos inválidos.' },
                { status: 400 }
            );
        }
        const { token, password } = parsed.data;

        const payload = verifyResetToken(token);
        if (!payload || !payload.id || !payload.email) {
            return NextResponse.json({ error: 'El enlace es inválido, ha expirado o está corrompido.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.id }
        });

        if (!user) {
            return NextResponse.json({ error: 'Usuario no encontrado. Es posible que la cuenta fuera eliminada.' }, { status: 404 });
        }

        // Validación estricta anti-reuso: si el prefijo del hash cambió en BD, el token es material quemado.
        const currentHashPrefix = user.password_hash ? user.password_hash.slice(0, 10) : '';
        if (payload.hashPrefix !== currentHashPrefix) {
            return NextResponse.json({ error: 'Este enlace ya fue utilizado para cambiar la contraseña anteriormente.' }, { status: 400 });
        }

        // Encriptar la nueva clave usando el mismo standard del registro (Fase 3)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Actualizar Base de Datos de forma asíncrona
        await prisma.user.update({
            where: { id: user.id },
            data: { password_hash: hashedPassword }
        });

        return NextResponse.json({ success: true, message: 'La contraseña ha sido actualizada satisfactoriamente.' });

    } catch (error: any) {
        console.error('Reset Password error:', error);
        return NextResponse.json({ error: 'Error procesando la regrabación de credenciales.' }, { status: 500 });
    }
}
