import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { resolveCoupon, consumeCoupon } from '@/lib/coupons';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe, isStripePaymentMethod } from '@/lib/stripe';
import { allocateAndDecrementStock } from '@/lib/warehouse';
import { captureError } from '@/lib/sentry';
import { checkoutSchema } from '@/lib/schemas/checkout';

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
        const rawBody = await request.json().catch(() => null);

        // ── Validación de formato (Zod) ────────────────────────────────────
        const parsed = checkoutSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos de checkout inválidos.' },
                { status: 400 }
            );
        }
        const { address, shippingMethodId, paymentMethod, items, locale, couponCode } = parsed.data;

        // El email sólo es obligatorio para invitados; con sesión se usa el
        // email de la cuenta. El formato ya lo valida el schema (`.email()`).
        const guestEmail = !session?.user?.id ? parsed.data.email ?? null : null;
        if (!session?.user?.id && !guestEmail) {
            return NextResponse.json({ error: 'Email requerido.' }, { status: 400 });
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

        for (const item of items) {
            const productId = item.product_id;
            const variantId = item.variant_id ?? null;
            const quantity = item.quantity;

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
            // La comprobación real de disponibilidad ocurre en allocateAndDecrementStock
            // (dentro de la transacción, más abajo) — NO aquí. `variant.stock` es sólo
            // el total cacheado de almacenes físicos: un almacén de drop shipping activo
            // puede cubrir el pedido aunque ese total sea 0, así que un guard temprano
            // basado en `variant.stock` rechazaría ventas válidas por error.
            const enforceStock = !product.unlimited_stock;

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
                variant_info: item.attributes ? JSON.stringify(item.attributes) : null,
                _enforce_stock: enforceStock,
            });
        }

        // Redondeo a céntimos: sumar floats (price * quantity) por cada item
        // puede arrastrar epsilon binario (19.990000000000002). El resto del
        // pipeline (descuento del cupón, total para Stripe) ya redondea —
        // sin esto, `subtotal` podía diferir en 1 céntimo del valor que
        // finalmente persiste `Order.total` (DECIMAL(10,2) trunca al guardar).
        subtotal = Math.round(subtotal * 100) / 100;

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

        // Desglose informativo de IVA (precios con IVA incluido, práctica
        // habitual en B2C español) — NO se suma al total, sólo documenta lo
        // que el total ya contiene. Usado también por el registro de
        // facturación Veri*Factu (src/lib/verifactu.ts) para que la factura
        // PDF y ese registro muestren siempre la misma cifra.
        const { getVatRate, splitVatFromTotal } = await import('@/lib/verifactu');
        const vatRate = await getVatRate(prisma);
        const { vatAmount } = splitVatFromTotal(total, vatRate);

        // ── 4. Transacción atómica: dirección + asignación de almacén/stock + orden ─
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

            // Generamos el id de la orden ANTES de crearla para poder usarlo
            // como reference_id de los StockMovement de asignación — la
            // asignación de almacén ocurre antes de tx.order.create() porque
            // el warehouse_id resuelto se persiste en cada OrderItem al crearlo.
            const orderId = randomUUID();

            // Asignación de almacén + decremento atómico. Si algún ítem no
            // encuentra almacén con stock suficiente, allocateAndDecrementStock
            // lanza y la transacción hace rollback completo (incluida la
            // dirección recién creada arriba).
            const itemsForOrder = [];
            for (const item of validatedItems) {
                let warehouseId: string | null = null;
                if (item.variant_id) {
                    try {
                        const allocation = await allocateAndDecrementStock(tx, {
                            variant_id: item.variant_id,
                            quantity: item.quantity,
                            enforceStock: item._enforce_stock,
                            reference_id: orderId,
                            note: `Order ${orderNumber}`,
                            user_id: session?.user?.id ?? null
                        });
                        warehouseId = allocation.warehouse_id;
                    } catch {
                        throw new Error(`Stock insuficiente para ${item.name}`);
                    }
                }
                const { _enforce_stock, ...rest } = item;
                itemsForOrder.push({ ...rest, warehouse_id: warehouseId });
            }

            // Si el método de pago va por pasarela externa, la orden nace
            // como PENDING_PAYMENT y sólo pasa a PENDING/CONFIRMED cuando el
            // webhook de Stripe confirme el pago. Para COD/TRANSFER seguimos
            // con PENDING (status comercial) y payment_status PENDING.
            const usesStripe = isStripePaymentMethod(paymentMethod);
            const newOrder = await tx.order.create({
                data: {
                    id: orderId,
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
                    tax: vatAmount,
                    total,
                    shipping_address_id: shippingAddress.id,
                    billing_address_id: shippingAddress.id,
                    shipping_method_id: shippingMethodId,
                    coupon_id: resolvedCoupon?.coupon.id ?? null,
                    locale: orderLocale,
                    order_items: {
                        create: itemsForOrder
                    }
                }
            });

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
