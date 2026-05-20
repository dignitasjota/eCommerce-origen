import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { ensureInvoiceNumber } from '@/lib/invoice';
import { buildInvoicePdf } from '@/lib/invoice-pdf';

/**
 * Descarga del PDF de la factura de una orden.
 *
 * Acceso:
 *   - ADMIN/ORDER_MANAGER: cualquier orden.
 *   - Cliente: sólo sus propias órdenes (verificación por user_id).
 *
 * El `invoice_number` se asigna lazy: si la orden no lo tenía aún (caso
 * de órdenes anteriores a esta feature, o COD/TRANSFER que aún no han
 * pasado por webhook PAID), `ensureInvoiceNumber()` lo genera al vuelo.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            users: { select: { id: true, name: true, email: true } },
            order_items: true,
            addresses_orders_billing_address_idToaddresses: true
        }
    });
    if (!order) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Autorización: admin o dueño de la orden.
    const role = session.user.role;
    const isAdmin = role === 'ADMIN' || role === 'ORDER_MANAGER';
    const isOwner = order.user_id && order.user_id === session.user.id;
    if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Sólo facturas para órdenes pagadas. Las otras carecen de sentido fiscal.
    if (order.payment_status !== 'PAID' && !isAdmin) {
        return NextResponse.json(
            { error: 'La factura sólo está disponible cuando el pedido está pagado.' },
            { status: 400 }
        );
    }

    const invoiceNumber = await ensureInvoiceNumber(prisma, order.id);

    // Cargar branding desde SiteSettings.
    const settings = await prisma.siteSetting.findMany({
        where: { key: { in: ['site_name', 'invoice_seller_tax_id', 'invoice_seller_address', 'invoice_seller_email'] } }
    });
    const get = (k: string) => settings.find((s) => s.key === k)?.value || '';

    const customerName =
        order.users?.name ||
        order.guest_name ||
        order.addresses_orders_billing_address_idToaddresses
            ? `${order.addresses_orders_billing_address_idToaddresses?.first_name ?? ''} ${
                  order.addresses_orders_billing_address_idToaddresses?.last_name ?? ''
              }`.trim()
            : 'Cliente';
    const customerEmail = order.users?.email || order.guest_email || '';

    const pdf = await buildInvoicePdf({
        invoice_number: invoiceNumber,
        order_number: order.order_number,
        issued_at: order.created_at,
        customer: { name: customerName as string, email: customerEmail },
        billing_address: order.addresses_orders_billing_address_idToaddresses,
        items: order.order_items.map((it) => ({
            name: it.name,
            sku: it.sku,
            quantity: it.quantity,
            price: Number(it.price)
        })),
        subtotal: Number(order.subtotal),
        shipping_cost: Number(order.shipping_cost),
        discount: Number(order.discount),
        tax: Number(order.tax),
        total: Number(order.total),
        seller: {
            name: get('site_name') || 'eShop',
            tax_id: get('invoice_seller_tax_id') || undefined,
            address: get('invoice_seller_address') || undefined,
            email: get('invoice_seller_email') || undefined
        }
    });

    const filename = `${invoiceNumber}.pdf`;
    return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'private, no-store'
        }
    });
}
