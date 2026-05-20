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

            case 'charge.refunded':
            case 'payment_intent.canceled':
                await handlePaymentRefunded(event.data.object as Stripe.PaymentIntent | Stripe.Charge);
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

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.payment_status === 'PAID') return;

    // El pago falló o la sesión expiró. Marcamos la orden como CANCELLED.
    // Liberar stock / revertir cupón requiere otra transacción; lo pasamos al
    // cron de limpieza para no proliferar lógica de revert aquí.
    await prisma.order.update({
        where: { id: orderId },
        data: {
            status: 'CANCELLED',
            payment_status: 'FAILED'
        }
    });
}

async function handlePaymentRefunded(obj: Stripe.PaymentIntent | Stripe.Charge) {
    const intentId = 'payment_intent' in obj && typeof obj.payment_intent === 'string'
        ? obj.payment_intent
        : obj.id;

    const order = await prisma.order.findFirst({
        where: { payment_intent_id: intentId },
        include: { order_items: { select: { variant_id: true, quantity: true } } }
    });
    if (!order) return;

    const previousStatus = order.status;
    const previousPaymentStatus = order.payment_status;

    // Idempotencia: si ya está REFUNDED, no volvemos a registrar movimientos.
    if (previousPaymentStatus === 'REFUNDED') return;

    const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
            status: 'REFUNDED',
            payment_status: 'REFUNDED'
        },
        include: { users: true }
    });

    // Restituir stock por las unidades refundidas. Asumimos refund total
    // (Stripe puede refundir parcial pero el evento charge.refunded no
    // distingue si no inspeccionamos `amount_refunded` vs `amount`).
    const { recordStockMovement } = await import('@/lib/stock');
    for (const item of order.order_items) {
        if (!item.variant_id) continue;
        await prisma.productVariant.update({
            where: { id: item.variant_id },
            data: { stock: { increment: item.quantity } }
        });
        await recordStockMovement({
            variant_id: item.variant_id,
            quantity: item.quantity,
            reason: 'REFUND',
            reference_id: order.id,
            note: `Refund of order ${order.order_number}`
        });
    }

    const { sendOrderStatusEmail } = await import('@/lib/emails/notify');
    await sendOrderStatusEmail(updated, { previousStatus, previousPaymentStatus });
}
