import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { resolveCoupon, consumeCoupon } from '@/lib/coupons';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe, isStripePaymentMethod } from '@/lib/stripe';
import { recordStockMovement } from '@/lib/stock';
import { captureError } from '@/lib/sentry';

/**
 * Genera un identificador de pedido público no predecible.
 * Formato: ORD-YYYYMM-XXXXXXXX (8 chars hex de crypto.randomBytes).
 * Espacio: 16^8 ≈ 4.3·10⁹ por mes ⇒ probabilidad de colisión despreciable
 * y sin enumeración por timestamp como tenía la versión anterior.
 */
function generateOrderNumber(): string {
    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${yyyymm}-${suffix}`;
}

interface ValidatedItem {
    product_id: string;
    variant_id: string | null;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    variant_info: string | null;
    // Internos para el decremento atómico de stock
    _enforce_stock: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asPositiveInt(value: unknown): number | null {
    const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    return Number.isInteger(n) && n > 0 && n <= 999 ? n : null;
}

export async function POST(request: NextRequest) {
    try {
        const limit = rateLimit(request, { bucket: 'checkout', max: 10, windowMs: 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiados intentos de checkout. Inténtalo en unos segundos.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const session = await auth();
        const body = await request.json();
        const { email, address, shippingMethodId, paymentMethod, items, locale, couponCode } = body ?? {};

        // ── Validación básica de formato ──────────────────────────────────
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No se puede procesar un carrito vacío.' }, { status: 400 });
        }
        if (items.length > 100) {
            return NextResponse.json({ error: 'Demasiados items en el carrito.' }, { status: 400 });
        }
        if (!shippingMethodId || typeof shippingMethodId !== 'string') {
            return NextResponse.json({ error: 'Método de envío requerido.' }, { status: 400 });
        }
        if (!paymentMethod || typeof paymentMethod !== 'string') {
            return NextResponse.json({ error: 'Método de pago requerido.' }, { status: 400 });
        }
        if (!address || typeof address !== 'object') {
            return NextResponse.json({ error: 'Dirección requerida.' }, { status: 400 });
        }
        const required = ['firstName', 'lastName', 'address1', 'city', 'postalCode', 'country'] as const;
        for (const k of required) {
            if (!address[k] || typeof address[k] !== 'string' || !address[k].trim()) {
                return NextResponse.json({ error: `Falta el campo de dirección: ${k}` }, { status: 400 });
            }
        }
        const guestEmail = !session?.user?.id ? String(email ?? '').trim().toLowerCase() : null;
        if (!session?.user?.id) {
            if (!guestEmail || !EMAIL_RE.test(guestEmail)) {
                return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
            }
        }

        const orderLocale = (locale === 'en' ? 'en' : 'es');

        // ── 1. Validar Método de Envío ────────────────────────────────────
        const shippingMethod = await prisma.shippingMethod.findUnique({
            where: { id: shippingMethodId }
        });

        if (!shippingMethod || !shippingMethod.is_active) {
            return NextResponse.json({ error: 'Método de envío inválido.' }, { status: 400 });
        }

        // ── 2. Validar productos / variantes y recomputar precios ─────────
        // No se confía en `price` ni `name` enviados por el cliente: se leen de DB.
        let subtotal = 0;
        const validatedItems: ValidatedItem[] = [];

        for (const raw of items as Array<Record<string, unknown>>) {
            const productId = typeof raw.product_id === 'string' ? raw.product_id : null;
            const variantId = typeof raw.variant_id === 'string' && raw.variant_id ? raw.variant_id : null;
            const quantity = asPositiveInt(raw.quantity);

            if (!productId || !quantity) {
                return NextResponse.json({ error: 'Item de carrito inválido.' }, { status: 400 });
            }

            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    product_translations: { where: { locale: orderLocale } },
                    product_variants: variantId
                        ? { where: { id: variantId } }
                        : { take: 1, orderBy: { id: 'asc' } }
                }
            });

            if (!product || !product.is_active) {
                return NextResponse.json({ error: 'Producto no disponible.' }, { status: 400 });
            }

            // Resolver variante: la indicada por el cliente, o la base del producto.
            const variant = product.product_variants[0];
            if (!variant || !variant.is_active) {
                return NextResponse.json({ error: `Variante no disponible para ${product.slug}` }, { status: 400 });
            }
            // Si el cliente pidió una variante concreta y no es la que devolvimos,
            // significa que esa variant_id no existe o no pertenece al producto.
            if (variantId && variant.id !== variantId) {
                return NextResponse.json({ error: 'Variante no válida.' }, { status: 400 });
            }

            // Stock: si el producto es unlimited_stock NO bloqueamos ni decrementamos.
            const enforceStock = !product.unlimited_stock;
            if (enforceStock && variant.stock < quantity) {
                const fallbackName = product.product_translations[0]?.name || product.slug;
                return NextResponse.json(
                    { error: `Stock insuficiente para ${fallbackName}` },
                    { status: 400 }
                );
            }

            // Precio definitivo desde DB (variant > product). Nunca del cliente.
            const price = Number(variant.price ?? product.price);
            if (!Number.isFinite(price) || price < 0) {
                return NextResponse.json({ error: 'Precio inválido en catálogo.' }, { status: 500 });
            }

            subtotal += price * quantity;

            validatedItems.push({
                product_id: product.id,
                variant_id: variantId ? variant.id : null,
                name: product.product_translations[0]?.name || product.slug,
                sku: variant.sku,
                price,
                quantity,
                // attributes se acepta solo como descriptor; nunca como precio.
                variant_info: raw.attributes ? JSON.stringify(raw.attributes) : null,
                _enforce_stock: enforceStock,
            });
        }

        // ── 3. Coste de envío ─────────────────────────────────────────────
        let shippingCost = Number(shippingMethod.price);
        if (shippingMethod.free_above && subtotal >= Number(shippingMethod.free_above)) {
            shippingCost = 0;
        }

        // ── 3.b. Cupón (opcional) ─────────────────────────────────────────
        // Resolución pre-transacción para devolver el error 400 limpio antes de
        // crear ninguna entidad. El consumo (`used_count++`) ocurre DENTRO de
        // la transacción para mantener atomicidad con el pedido.
        let resolvedCoupon: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
        if (typeof couponCode === 'string' && couponCode.trim()) {
            try {
                resolvedCoupon = await resolveCoupon(prisma, couponCode, subtotal);
            } catch (e: any) {
                return NextResponse.json({ error: e?.message || 'Cupón no válido.' }, { status: 400 });
            }
        }
        const discount = resolvedCoupon?.discount ?? 0;

        const total = Math.max(0, subtotal - discount + shippingCost);
        const orderNumber = generateOrderNumber();

        // ── 4. Transacción atómica: dirección + orden + decremento de stock ─
        const order = await prisma.$transaction(async (tx) => {
            const shippingAddress = await tx.address.create({
                data: {
                    user_id: session?.user?.id || null,
                    first_name: address.firstName,
                    last_name: address.lastName,
                    address1: address.address1,
                    address2: address.address2 || null,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postalCode,
                    country: address.country,
                    phone: address.phone
                }
            });

            // Si el método de pago va por pasarela externa, la orden nace
            // como PENDING_PAYMENT y sólo pasa a PENDING/CONFIRMED cuando el
            // webhook de Stripe confirme el pago. Para COD/TRANSFER seguimos
            // con PENDING (status comercial) y payment_status PENDING.
            const usesStripe = isStripePaymentMethod(paymentMethod);
            const newOrder = await tx.order.create({
                data: {
                    order_number: orderNumber,
                    user_id: session?.user?.id || null,
                    guest_email: !session?.user?.id ? guestEmail : null,
                    guest_name: !session?.user?.id ? `${address.firstName} ${address.lastName}` : null,
                    status: usesStripe ? 'PENDING_PAYMENT' : 'PENDING',
                    payment_status: 'PENDING',
                    payment_method: paymentMethod,
                    subtotal,
                    shipping_cost: shippingCost,
                    discount,
                    tax: 0,
                    total,
                    shipping_address_id: shippingAddress.id,
                    billing_address_id: shippingAddress.id,
                    shipping_method_id: shippingMethodId,
                    coupon_id: resolvedCoupon?.coupon.id ?? null,
                    locale: orderLocale,
                    order_items: {
                        create: validatedItems.map(({ _enforce_stock, ...rest }) => rest)
                    }
                }
            });

            // Decremento atómico: updateMany con guardia stock>=quantity.
            // Si dos checkouts compiten por el último ítem, sólo uno actualiza
            // (count === 1) y el otro hace count === 0 → abortamos y la transacción
            // hace rollback de la orden recién creada.
            for (const item of validatedItems) {
                if (!item._enforce_stock || !item.variant_id) continue;

                const result = await tx.productVariant.updateMany({
                    where: { id: item.variant_id, stock: { gte: item.quantity } },
                    data: { stock: { decrement: item.quantity } }
                });

                if (result.count !== 1) {
                    throw new Error(`Stock insuficiente para ${item.name}`);
                }

                // Trazar el movimiento de stock dentro de la misma transacción.
                await recordStockMovement(
                    {
                        variant_id: item.variant_id,
                        quantity: -item.quantity, // negativo = salida
                        reason: 'PURCHASE',
                        reference_id: newOrder.id,
                        note: `Order ${newOrder.order_number}`,
                        user_id: session?.user?.id ?? null
                    },
                    tx
                );
            }

            // Consumo atómico del cupón (incremento de used_count con guardia).
            // Si en la condición de carrera ya se agotaron los usos, abortamos
            // y la transacción hace rollback de la orden.
            if (resolvedCoupon) {
                const consumed = await consumeCoupon(tx, resolvedCoupon.coupon);
                if (!consumed) {
                    throw new Error('Cupón agotado');
                }
            }

            return newOrder;
        });

        const customerName = session?.user?.name || `${address.firstName} ${address.lastName}`;
        const customerEmail = session?.user?.email || guestEmail!;

        // ── 5. Stripe Checkout Session (si aplica) ─────────────────────────
        // La orden ya existe en estado PENDING_PAYMENT con stock reservado y
        // cupón consumido (la transacción cerró arriba). Si el usuario abandona
        // la pasarela, una limpieza posterior puede liberar la orden vencida —
        // gestionarlo con un cron es Sprint posterior.
        if (isStripePaymentMethod(paymentMethod)) {
            try {
                const stripe = await getStripe();
                const baseUrl =
                    process.env.NEXT_PUBLIC_APP_URL ||
                    `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

                const stripeSession = await stripe.checkout.sessions.create({
                    mode: 'payment',
                    payment_method_types: ['card'],
                    customer_email: customerEmail,
                    line_items: [
                        {
                            quantity: 1,
                            price_data: {
                                currency: 'eur',
                                unit_amount: Math.round(total * 100),
                                product_data: {
                                    name: `Pedido ${order.order_number}`,
                                    description: validatedItems
                                        .map((i) => `${i.quantity}× ${i.name}`)
                                        .join(', ')
                                        .slice(0, 500)
                                }
                            }
                        }
                    ],
                    success_url: `${baseUrl}/${orderLocale}/checkout/success/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${baseUrl}/${orderLocale}/checkout?cancelled=1`,
                    metadata: {
                        order_id: order.id,
                        order_number: order.order_number
                    },
                    payment_intent_data: {
                        metadata: {
                            order_id: order.id,
                            order_number: order.order_number
                        }
                    }
                });

                // Persistimos el intent para idempotencia y trazabilidad.
                if (stripeSession.payment_intent) {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            payment_intent_id:
                                typeof stripeSession.payment_intent === 'string'
                                    ? stripeSession.payment_intent
                                    : stripeSession.payment_intent.id,
                            payment_id: stripeSession.id
                        }
                    });
                } else {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: { payment_id: stripeSession.id }
                    });
                }

                return NextResponse.json({
                    success: true,
                    orderId: order.id,
                    checkoutUrl: stripeSession.url
                });
            } catch (stripeError: any) {
                console.error('Stripe checkout error:', stripeError);
                // Marcar la orden como cancelada para que el cron la limpie
                // y devolver stock/cupón si ya estuviese consumido. Esto último
                // requiere otra transacción; por ahora la orden queda en
                // PENDING_PAYMENT y un job posterior la liberará.
                return NextResponse.json(
                    { error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' },
                    { status: 502 }
                );
            }
        }

        // ── 6. Email de confirmación (sólo COD/TRANSFER) ───────────────────
        // Para Stripe el email lo dispara el webhook al confirmarse el pago.
        try {
            const { sendEmail } = await import('@/lib/email');
            const { getOrderConfirmationEmailHtml } = await import('@/lib/emails/order-confirmation');

            await sendEmail({
                to: customerEmail,
                subject: `Detalles de tu Pedido #${order.order_number}`,
                html: getOrderConfirmationEmailHtml(
                    order.order_number,
                    customerName,
                    validatedItems.map(({ _enforce_stock, ...rest }) => rest),
                    total
                )
            });
        } catch (emailError) {
            console.error('Non-blocking error sending confirmation email:', emailError);
        }

        return NextResponse.json({ success: true, orderId: order.id });

    } catch (error: any) {
        console.error('Checkout error:', error);
        // Si el rollback fue por stock o cupón agotado, devolver 409 (Conflict)
        // para que el cliente pueda reintentar / actualizar el carrito.
        if (typeof error?.message === 'string' &&
            (error.message.startsWith('Stock insuficiente') || error.message === 'Cupón agotado')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        // Reportar a Sentry SOLO los errores no clasificados — los 409 son
        // negocio normal y filtrarlos genera ruido.
        captureError(error, { tags: { area: 'checkout' } });
        return NextResponse.json({ error: 'Error interno procesando el checkout' }, { status: 500 });
    }
}
