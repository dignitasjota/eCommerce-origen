import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import prisma from '@/lib/db';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';
import { captureError } from '@/lib/sentry';

/**
 * Webhook de Stripe.
 *
 * Idempotencia:
 *   - Cada `event.id` se inserta en la tabla `webhook_events` con un unique
 *     compuesto (provider, event_id). Si Stripe re-entrega el mismo evento
 *     (cosa habitual en redes flakey o en reintentos), la inserción duplicada
 *     falla con P2002 y devolvemos 200 sin hacer nada.
 *
 * Seguridad:
 *   - Verificamos la firma con `stripe.webhooks.constructEvent`. Sin firma
 *     válida (falta del secret o body manipulado) devolvemos 400.
 *
 * Importante para Plesk/Passenger:
 *   - Hay que leer el body como string crudo (`req.text()`) ANTES de parsearlo
 *     a JSON. Si se pasa el body parseado al verificador, la firma fallará.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const webhookSecret = await getStripeWebhookSecret();
    if (!webhookSecret) {
        console.error('[stripe-webhook] webhook secret no configurado en SiteSettings ni env');
        return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
        return NextResponse.json({ error: 'Falta cabecera stripe-signature' }, { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
        const stripe = await getStripe();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        console.error('[stripe-webhook] firma inválida:', err?.message);
        return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
    }

    // ── Idempotencia: registrar el evento; si ya estaba, salir 200 ───
    try {
        await prisma.webhookEvent.create({
            data: {
                provider: 'stripe',
                event_id: event.id,
                event_type: event.type
            }
        });
    } catch (e: any) {
        if (e?.code === 'P2002') {
            // Ya procesado: respuesta exitosa sin re-ejecutar efectos.
            return NextResponse.json({ received: true, duplicated: true });
        }
        console.error('[stripe-webhook] error registrando evento:', e);
        // No bloqueamos el ack para no inducir reintentos infinitos: Stripe
        // re-envía hasta 3 días, y un error transitorio aquí no debe dejar la
        // orden colgada. Devolvemos 500 para que Stripe reintente.
        return NextResponse.json({ error: 'No se pudo registrar el evento' }, { status: 500 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'checkout.session.async_payment_succeeded':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'checkout.session.async_payment_failed':
            case 'checkout.session.expired':
                await handleCheckoutFailed(event.data.object as Stripe.Checkout.Session);
                break;

            case 'payment_intent.canceled':
                // El PaymentIntent se canceló antes de capturar el pago (nunca
                // llegó a PAID) — es un fallo de pago, NO un reembolso. Va por
                // el mismo camino que un checkout fallido/expirado.
                await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object as Stripe.Charge);
                break;

            default:
                // Otros eventos no nos interesan; los ignoramos en silencio.
                break;
        }
    } catch (err) {
        console.error(`[stripe-webhook] error procesando ${event.type}:`, err);
        captureError(err, {
            tags: { area: 'webhook', provider: 'stripe', event_type: event.type },
            extra: { event_id: event.id }
        });
        // Devolver 500 hace que Stripe reintente. La idempotencia por
        // (provider, event_id) ya impide el doble procesamiento si el
        // siguiente intento llega cuando este ya finalizó.
        return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    if (!orderId) {
        console.warn('[stripe-webhook] checkout.session.completed sin order_id en metadata');
        return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
        console.warn('[stripe-webhook] order_id no encontrado:', orderId);
        return;
    }
    if (order.payment_status === 'PAID') {
        return; // ya marcada (probablemente por otro evento previo)
    }

    const paymentIntentId =
        typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

    // Actualización de orden + asignación de invoice_number en una sola
    // transacción: si algo falla, ni la orden queda PAID ni se consume un
    // número del contador correlativo (compliance fiscal).
    try {
        const { claimInvoiceNumber } = await import('@/lib/invoice');
        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'CONFIRMED',
                    payment_status: 'PAID',
                    payment_id: session.id,
                    payment_intent_id: paymentIntentId ?? order.payment_intent_id
                }
            });
            await claimInvoiceNumber(tx, orderId);
        });
    } catch (e) {
        console.error('[stripe-webhook] error confirmando orden:', e);
        throw e; // Re-throw para que Stripe reintente
    }

    // Email de confirmación (best-effort, fuera de la actualización).
    try {
        const { sendEmail } = await import('@/lib/email');
        const { getOrderConfirmationEmailHtml } = await import('@/lib/emails/order-confirmation');

        const refreshed = await prisma.order.findUnique({
            where: { id: orderId },
            include: { order_items: true, users: true }
        });
        const recipient = refreshed?.users?.email || refreshed?.guest_email;
        const customerName = refreshed?.users?.name || refreshed?.guest_name || 'Cliente';

        if (recipient && refreshed) {
            await sendEmail({
                to: recipient,
                subject: `Confirmación de tu Pedido #${refreshed.order_number}`,
                html: getOrderConfirmationEmailHtml(
                    refreshed.order_number,
                    customerName,
                    refreshed.order_items.map((i) => ({
                        product_name: i.name,
                        name: i.name,
                        quantity: i.quantity,
                        price: Number(i.price)
                    })),
                    Number(refreshed.total)
                )
            });
        }
    } catch (emailError) {
        console.error('[stripe-webhook] error enviando email confirmación:', emailError);
    }
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;
    await revertOrderReservation(orderId, 'stripe_event:checkout_failed_or_expired');
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.order_id;
    if (!orderId) return;
    await revertOrderReservation(orderId, 'stripe_event:payment_intent_canceled');
}

/**
 * Libera la reserva de una orden que nunca llegó a pagarse (checkout
 * fallido/expirado o PaymentIntent cancelado antes de capturar el cobro):
 * restituye stock, revierte el uso del cupón y marca CANCELLED+FAILED, todo
 * en una única transacción con guard atómico — igual patrón que usa el cron
 * `cleanup-pending-orders` para las órdenes que el cliente abandona sin
 * pasar siquiera por Stripe. Sin esto, la orden queda en CANCELLED pero
 * fuera del alcance de ese cron (que sólo mira `status='PENDING_PAYMENT'`),
 * dejando stock y usos de cupón reservados para siempre.
 *
 * Idempotente y a salvo de condiciones de carrera entre eventos: el guard
 * `updateMany` en el `status` de la orden asegura que sólo un evento
 * concurrente (p.ej. `checkout.session.expired` y `payment_intent.canceled`
 * para la misma orden) llegue a restituir stock.
 */
async function revertOrderReservation(orderId: string, reason: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { order_items: { select: { variant_id: true, quantity: true } } }
    });
    if (!order || order.payment_status === 'PAID') return;

    const { recordStockMovement } = await import('@/lib/stock');

    const reverted = await prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
            where: { id: orderId, status: { not: 'CANCELLED' }, payment_status: { not: 'PAID' } },
            data: { status: 'CANCELLED', payment_status: 'FAILED' }
        });
        if (claim.count !== 1) return false;

        for (const item of order.order_items) {
            if (!item.variant_id) continue;
            await tx.productVariant.update({
                where: { id: item.variant_id },
                data: { stock: { increment: item.quantity } }
            });
            await recordStockMovement(
                {
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    reason: 'RESERVATION_RELEASE',
                    reference_id: order.id,
                    note: `Order ${order.order_number} — ${reason}`
                },
                tx
            );
        }

        if (order.coupon_id) {
            await tx.coupon.updateMany({
                where: { id: order.coupon_id, used_count: { gt: 0 } },
                data: { used_count: { decrement: 1 } }
            });
        }

        return true;
    });

    if (reverted) {
        const { auditLogServer } = await import('@/lib/audit');
        await auditLogServer({
            action: 'order.payment_failed',
            entity_type: 'Order',
            entity_id: order.id,
            metadata: { order_number: order.order_number, reason }
        });
    }
}

/**
 * `charge.refunded` dispara tanto en reembolsos totales como parciales, y
 * tanto si el reembolso lo inició nuestro propio flujo RMA (`refundReturn`,
 * que YA restituye stock condicionalmente por ítem al marcar la devolución
 * como recibida) como si se hizo a mano desde el Dashboard de Stripe.
 * Distinguimos ambos casos para no duplicar la restitución de stock ni
 * marcar la orden REFUNDED de forma incorrecta ante un reembolso parcial.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) return;

    const order = await prisma.order.findFirst({
        where: { payment_intent_id: intentId },
        include: { order_items: { select: { variant_id: true, quantity: true } } }
    });
    if (!order || order.payment_status === 'REFUNDED') return;

    const isFullRefund = charge.amount_refunded >= charge.amount;

    // ¿Este reembolso ya lo gestionó /admin/returns (refundReturn)? Consultamos
    // la lista real de refunds del PaymentIntent en Stripe (no nos fiamos de
    // `charge.refunds` del payload del evento, que puede no venir expandido)
    // y buscamos un Return con ese `stripe_refund_id`.
    const stripe = await getStripe();
    const refundsList = await stripe.refunds.list({ payment_intent: intentId, limit: 20 });
    const refundIds = refundsList.data.map((r) => r.id);
    const handledByReturn =
        refundIds.length > 0
            ? await prisma.return.findFirst({
                  where: { order_id: order.id, stripe_refund_id: { in: refundIds } },
                  select: { id: true }
              })
            : null;

    if (handledByReturn) {
        // Stock y AuditLog ya los gestionó markReturnReceived/refundReturn.
        // Sólo reflejamos en la orden si Stripe confirma que se devolvió el
        // importe TOTAL (para que el listado de pedidos no la siga mostrando
        // como pagada cuando en realidad ya no queda nada cobrado).
        if (isFullRefund) {
            await prisma.order.updateMany({
                where: { id: order.id, payment_status: { not: 'REFUNDED' } },
                data: { status: 'REFUNDED', payment_status: 'REFUNDED' }
            });
        }
        return;
    }

    if (!isFullRefund) {
        // Reembolso parcial fuera del flujo RMA (p.ej. desde el Dashboard de
        // Stripe a mano): no hay forma fiable de saber qué ítems corresponden,
        // así que no adivinamos qué stock restituir ni tocamos el estado de
        // la orden. Dejamos rastro para revisión manual.
        const { auditLogServer } = await import('@/lib/audit');
        await auditLogServer({
            action: 'order.partial_refund_unmanaged',
            entity_type: 'Order',
            entity_id: order.id,
            metadata: {
                order_number: order.order_number,
                amount_refunded: charge.amount_refunded,
                amount: charge.amount
            }
        });
        console.warn(
            `[stripe-webhook] reembolso parcial fuera del flujo RMA para pedido ${order.order_number} — requiere revisión manual`
        );
        return;
    }

    // Reembolso total fuera del flujo RMA: comportamiento legacy completo
    // (restituir todo el stock de la orden + revertir cupón + marcar REFUNDED).
    const previousStatus = order.status;
    const previousPaymentStatus = order.payment_status;
    const { recordStockMovement } = await import('@/lib/stock');

    const updated = await prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
            where: { id: order.id, payment_status: { not: 'REFUNDED' } },
            data: { status: 'REFUNDED', payment_status: 'REFUNDED' }
        });
        if (claim.count !== 1) return null;

        for (const item of order.order_items) {
            if (!item.variant_id) continue;
            await tx.productVariant.update({
                where: { id: item.variant_id },
                data: { stock: { increment: item.quantity } }
            });
            await recordStockMovement(
                {
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    reason: 'REFUND',
                    reference_id: order.id,
                    note: `Refund of order ${order.order_number}`
                },
                tx
            );
        }

        if (order.coupon_id) {
            await tx.coupon.updateMany({
                where: { id: order.coupon_id, used_count: { gt: 0 } },
                data: { used_count: { decrement: 1 } }
            });
        }

        return tx.order.findUnique({ where: { id: order.id }, include: { users: true } });
    });

    if (!updated) return; // otro evento concurrente ya lo procesó

    const { sendOrderStatusEmail } = await import('@/lib/emails/notify');
    await sendOrderStatusEmail(updated, { previousStatus, previousPaymentStatus });
}
