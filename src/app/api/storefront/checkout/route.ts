import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

interface ValidatedItem {
    product_id: string;
    variant_id: string | null;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    variant_info: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const body = await request.json();
        const { email, address, shippingMethodId, paymentMethod, items } = body;

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No se puede procesar un carrito vacío.' }, { status: 400 });
        }

        // 1. Validar Método de Envío
        const shippingMethod = await prisma.shippingMethod.findUnique({
            where: { id: shippingMethodId }
        });

        if (!shippingMethod || !shippingMethod.is_active) {
            return NextResponse.json({ error: 'Método de envío inválido.' }, { status: 400 });
        }

        // 2. Validar Existencias y Recalcular Totales de Forma Segura (Server-Side)
        let subtotal = 0;
        const validatedItems: ValidatedItem[] = [];

        for (const item of items) {
            if (item.variant_id) {
                // Producto con variantes
                const variant = await prisma.productVariant.findUnique({
                    where: { id: item.variant_id },
                    include: { products: true }
                });

                if (!variant || variant.stock < item.quantity) {
                    return NextResponse.json({ error: `Stock insuficiente para ${item.name}` }, { status: 400 });
                }

                const price = Number(variant.price || variant.products.price);
                subtotal += price * item.quantity;

                validatedItems.push({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    name: item.name,
                    sku: variant.sku,
                    price: price,
                    quantity: item.quantity,
                    variant_info: item.attributes ? JSON.stringify(item.attributes) : null,
                });
            } else {
                // Producto simple sin variantes
                const product = await prisma.product.findUnique({
                    where: { id: item.product_id }
                });

                if (!product) {
                    return NextResponse.json({ error: `Producto no encontrado: ${item.name}` }, { status: 400 });
                }

                const price = Number(product.price);
                subtotal += price * item.quantity;

                validatedItems.push({
                    product_id: item.product_id,
                    variant_id: null,
                    name: item.name,
                    sku: product.sku,
                    price: price,
                    quantity: item.quantity,
                    variant_info: null,
                });
            }
        }

        // 3. Calcular Costo de Envío real
        let shippingCost = Number(shippingMethod.price);
        if (shippingMethod.free_above && subtotal >= Number(shippingMethod.free_above)) {
            shippingCost = 0;
        }

        const total = subtotal + shippingCost;
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        // 4. Iniciar Transacción en Base de Datos (Seguridad ACiD)
        const order = await prisma.$transaction(async (tx) => {

            // A. Instanciar una Dirección permanente para este pedido
            const shippingAddress = await tx.address.create({
                data: {
                    user_id: session?.user?.id || null, // Opcional, si hay cuenta
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

            // B. Crear el registro del Pedido asumiendo Estado Inicial
            const newOrder = await tx.order.create({
                data: {
                    order_number: orderNumber,
                    user_id: session?.user?.id || null,
                    guest_email: !session?.user?.id ? email : null,
                    guest_name: !session?.user?.id ? `${address.firstName} ${address.lastName}` : null,
                    status: 'PENDING',
                    payment_status: 'PENDING',
                    payment_method: paymentMethod, // 'COD' o 'TRANSFER'
                    subtotal: subtotal,
                    shipping_cost: shippingCost,
                    discount: 0,
                    tax: 0,
                    total: total,
                    shipping_address_id: shippingAddress.id,
                    billing_address_id: shippingAddress.id, // Misma direción de facturación por defecto
                    shipping_method_id: shippingMethodId,
                    order_items: {
                        create: validatedItems
                    }
                }
            });

            // C. Descontar Inventario / Stock
            for (const item of validatedItems) {
                if (item.variant_id) {
                    await tx.productVariant.update({
                        where: { id: item.variant_id },
                        data: { stock: { decrement: item.quantity } }
                    });
                }
            }

            return newOrder;
        });

        // 5. Enviar Correo Electrónico de Confirmación de Pedido
        try {
            const { sendEmail } = await import('@/lib/email');
            const { getOrderConfirmationEmailHtml } = await import('@/lib/emails/order-confirmation');

            const customerName = session?.user?.name || `${address.firstName} ${address.lastName}`;
            const customerEmail = session?.user?.email || email;

            await sendEmail({
                to: customerEmail,
                subject: `Detalles de tu Pedido #${order.order_number}`,
                html: getOrderConfirmationEmailHtml(order.order_number, customerName, validatedItems, total)
            });
        } catch (emailError) {
            console.error('Non-blocking error sending confirmation email:', emailError);
            // We intentionally swallow this error to not break the successful checkout response
        }

        // 6. Devolver ID del Pedido al Frontend para redirigir a Success
        return NextResponse.json({ success: true, orderId: order.id });

    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: error.message || 'Error interno procesando el checkout' }, { status: 500 });
    }
}
