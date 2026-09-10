import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { AB_HERO_TEST_KEY } from '@/lib/ab-testing';

/**
 * Registra una impresión o un click del test A/B del hero de home. Anónimo
 * a propósito — no depende de sesión. `sendBeacon`/`fetch(keepalive)` en el
 * cliente lo disparan sin bloquear la navegación del propio CTA.
 */
const eventSchema = z.object({
    variant: z.enum(['A', 'B']),
    eventType: z.enum(['impression', 'click'])
});

export async function POST(request: Request) {
    const limit = rateLimit(request, { bucket: 'ab-test', max: 30, windowMs: 60_000 });
    if (!limit.ok) {
        return NextResponse.json({ error: 'Demasiadas peticiones.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    try {
        await prisma.abTestEvent.create({
            data: { test_key: AB_HERO_TEST_KEY, variant: parsed.data.variant, event_type: parsed.data.eventType }
        });
    } catch (e) {
        // Best-effort: un fallo al registrar un evento de analítica no debe
        // romper nada visible para el usuario.
        console.error('[ab-test] error registrando evento:', e);
    }

    return NextResponse.json({ ok: true });
}
