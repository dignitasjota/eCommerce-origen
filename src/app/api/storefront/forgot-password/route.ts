import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getPasswordResetEmailHtml } from '@/lib/emails/password-reset';
import crypto from 'crypto';

// Utilidad simple para firmar tokens JWT-like sin dependencias externas
function signToken(payload: object) {
    const secret = process.env.NEXTAUTH_SECRET || 'fallback_development_secret_only';
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
}

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Devolvemos 200 siempre por seguridad (evita enumaración de emails)
            return NextResponse.json({ success: true, message: 'El correo ha sido enviado si la cuenta existe.' });
        }

        // Crear token que expira en 1 hora, vinculando la clave hash actual 
        // para que si cambia la contraseña, el token anterior quede inválido automáticamente.
        const tokenPayload = {
            id: user.id,
            email: user.email,
            hashPrefix: user.password_hash ? user.password_hash.slice(0, 10) : '',
            exp: Date.now() + 3600000 // +1 hora
        };

        const token = signToken(tokenPayload);

        // Construir URL Base
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host') || 'localhost:3000';
        const resetUrl = `${protocol}://${host}/auth/reset-password?token=${token}`;

        // Enviar Correo
        await sendEmail({
            to: user.email,
            subject: 'Recuperación de Contraseña - eShop',
            html: getPasswordResetEmailHtml(user.name || 'Cliente', resetUrl)
        });

        return NextResponse.json({ success: true, message: 'Correo enviado.' });

    } catch (error: any) {
        console.error('Forgot Password error:', error);
        return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500 });
    }
}
