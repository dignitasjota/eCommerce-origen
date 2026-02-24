import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Verificador criptográfico pareado con forgot-password/route.ts
function verifyToken(token: string) {
    const secret = process.env.NEXTAUTH_SECRET || 'fallback_development_secret_only';
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    // Prevención de ataques de tiempo
    if (signature !== expectedSignature) return null;

    try {
        const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json();

        if (!token || !password || password.length < 6) {
            return NextResponse.json({ error: 'Token inválido o la contraseña es demasiado corta (min. 6)' }, { status: 400 });
        }

        const payload = verifyToken(token);
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
