import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { registerSchema } from '@/lib/schemas';

export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'register', max: 5, windowMs: 10 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await req.json();
        const { name, email, password } = registerSchema.parse(body);

        // Check if user already exists.
        //
        // A diferencia de /api/storefront/forgot-password (que siempre
        // responde 200 para no confirmar si un email tiene cuenta), aquí SÍ
        // se revela la colisión de forma explícita. Es una decisión
        // intencional, no una inconsistencia: es el patrón estándar en
        // registro (GitHub, etc. hacen lo mismo) porque la alternativa —
        // fingir éxito sin crear nada — deja al usuario sin ninguna pista de
        // por qué nunca recibe el email de bienvenida. El rate-limit de este
        // endpoint (5 intentos / 10 min por IP, arriba) ya acota el uso de
        // este endpoint para enumerar emails a gran escala.
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        const hashedPassword = await hash(password, 12);

        // Create the user with CUSTOMER role
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password_hash: hashedPassword,
                role: 'CUSTOMER'
            }
        });

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
        }

        console.error('Registration Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message || error.toString() },
            { status: 500 }
        );
    }
}
