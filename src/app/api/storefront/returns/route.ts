import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import {
    generateReturnNumber,
    assertOrderEligibleForReturn,
    getRemainingReturnableQty
} from '@/lib/returns';
import { auditLog } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { getReturnStatusEmailHtml } from '@/lib/emails/return-status';

/**
 * `POST /api/storefront/returns` — el cliente solicita una devolución.
 *
 * Body:
 *   {
 *     order_id: string,
 *     reason: string,
 *     items: [{ order_item_id, quantity, condition, reason? }, ...]
 *   }
 *
 * Validaciones:
 *   1. Sesión activa.
 *   2. Order DELIVERED, PAID, dentro de la ventana RETURN_WINDOW_DAYS.
 *   3. Cada item: existe en la orden, quantity > 0, no excede el stock
 *      restante (qty pedida menos devoluciones previas no rechazadas).
 *   4. Rate limit 5 / 30 min por IP (evitar spam de devoluciones).
 *
 * Respuesta: `{ id, return_number }` para que el cliente vea el ticket.
 */

const itemSchema = z.object({
    order_item_id: z.string().min(1).max(36),
    quantity: z.number().int().min(1).max(999),
    condition: z.enum(['UNOPENED', 'OPENED', 'DAMAGED', 'USED']).optional(),
    reason: z.string().trim().max(500).optional().nullable()
});

const bodySchema = z.object({
    order_id: z.string().min(1).max(36),
    reason: z.string().trim().min(5, 'Cuéntanos brevemente por qué').max(1000),
    items: z.array(itemSchema).min(1, 'Selecciona al menos un producto').max(50)
});

export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'returns', max: 5, windowMs: 30 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
                { status: 400 }
            );
        }

        // Elegibilidad de la orden.
        await assertOrderEligibleForReturn(prisma, parsed.data.order_id, session.user.id);

        // Validar cada item: pertenece a la orden y la cantidad es <= disponible.
        for (const it of parsed.data.items) {
            const orderItem = await prisma.orderItem.findUnique({
                where: { id: it.order_item_id },
                select: { order_id: true, quantity: true }
            });
            if (!orderItem || orderItem.order_id !== parsed.data.order_id) {
                return NextResponse.json(
                    { error: 'Algún producto no pertenece a esta orden' },
                    { status: 400 }
                );
            }
            const remaining = await getRemainingReturnableQty(prisma, it.order_item_id);
            if (it.quantity > remaining) {
                return NextResponse.json(
                    { error: `Sólo puedes devolver hasta ${remaining} unidades de ese producto` },
                    { status: 400 }
                );
            }
        }

        // Crear Return + ReturnItems en transacción.
        const created = await prisma.$transaction(async (tx) => {
            return tx.return.create({
                data: {
                    return_number: generateReturnNumber(),
                    order_id: parsed.data.order_id,
                    user_id: session.user.id,
                    status: 'REQUESTED',
                    reason: parsed.data.reason,
                    return_items: {
                        create: parsed.data.items.map((it) => ({
                            order_item_id: it.order_item_id,
                            quantity: it.quantity,
                            condition: it.condition || 'UNOPENED',
                            reason: it.reason || null
                        }))
                    }
                },
                include: { return_items: true }
            });
        });

        // Email al cliente confirmando la solicitud.
        try {
            await sendEmail({
                to: session.user.email,
                subject: `Devolución solicitada — #${created.return_number}`,
                html: getReturnStatusEmailHtml(
                    created.return_number,
                    session.user.name || 'Cliente',
                    'REQUESTED'
                )
            });
        } catch (e) {
            console.error('[returns] email solicitud failed:', (e as Error).message);
        }

        await auditLog({
            action: 'return.create',
            entity_type: 'Return',
            entity_id: created.id,
            metadata: {
                return_number: created.return_number,
                order_id: parsed.data.order_id,
                items: created.return_items.length
            }
        });

        return NextResponse.json({
            id: created.id,
            return_number: created.return_number,
            status: created.status
        });
    } catch (e: any) {
        if (e?.message?.match(/Pedido|permiso|entregados|pagados|ventana/i)) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }
        console.error('[returns] POST error:', e);
        return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500 });
    }
}
