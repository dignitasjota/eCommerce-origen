import { sendEmail } from '@/lib/email';
import { getOrderStatusUpdateEmailHtml } from '@/lib/emails/order-status-update';
import type { Order } from '@prisma/client';

type OrderForEmail = Pick<
    Order,
    'order_number' | 'status' | 'payment_status' | 'tracking_number' | 'guest_email' | 'guest_name' | 'user_id'
> & {
    users?: { email: string; name: string | null } | null;
};

interface NotifyOptions {
    /** Estado anterior para decidir si hace falta notificar. */
    previousStatus?: string;
    previousPaymentStatus?: string;
}

const STATUS_SUBJECT_ES: Record<string, string> = {
    PENDING_PAYMENT: 'Pago pendiente',
    PENDING: 'Pedido recibido',
    CONFIRMED: 'Pedido confirmado',
    PROCESSING: 'Pedido en preparación',
    SHIPPED: 'Pedido enviado',
    DELIVERED: 'Pedido entregado',
    CANCELLED: 'Pedido cancelado',
    REFUNDED: 'Pedido reembolsado'
};

/**
 * Envía un email transaccional al cliente cuando cambia el estado comercial
 * (`status`) o el estado de pago (`payment_status`) del pedido. Es best-effort:
 * no lanza si SMTP falla; deja constancia en logs.
 *
 * Reglas:
 *   - Solo notifica si el nuevo estado difiere del anterior (evita duplicados
 *     cuando el admin guarda el formulario sin cambios reales).
 *   - PENDING_PAYMENT no se notifica: ese estado existe sólo mientras el
 *     usuario está en la pasarela; si cancela, ya recibirá CANCELLED.
 *   - REFUNDED del payment_status también dispara email aunque el `status`
 *     no haya variado.
 */
export async function sendOrderStatusEmail(order: OrderForEmail, opts: NotifyOptions = {}) {
    const recipient = order.users?.email || order.guest_email;
    if (!recipient) return { sent: false, reason: 'no recipient' };

    const customerName = order.users?.name || order.guest_name || 'Cliente';

    const statusChanged = opts.previousStatus !== undefined && opts.previousStatus !== order.status;
    const paymentChanged =
        opts.previousPaymentStatus !== undefined && opts.previousPaymentStatus !== order.payment_status;

    if (!statusChanged && !paymentChanged) {
        return { sent: false, reason: 'no change' };
    }
    if (order.status === 'PENDING_PAYMENT') {
        return { sent: false, reason: 'pending payment - skip' };
    }

    // Si cambió el pago a REFUNDED, prima esa notificación.
    const focusStatus = order.payment_status === 'REFUNDED' ? 'REFUNDED' : order.status;
    const subjectLabel = STATUS_SUBJECT_ES[focusStatus] || 'Actualización de tu pedido';
    const subject = `${subjectLabel} — #${order.order_number}`;

    try {
        await sendEmail({
            to: recipient,
            subject,
            html: getOrderStatusUpdateEmailHtml(order.order_number || '', customerName, focusStatus, {
                trackingNumber: order.tracking_number
            })
        });
        return { sent: true };
    } catch (e) {
        console.error('[email] sendOrderStatusEmail failed:', e);
        return { sent: false, reason: 'smtp error' };
    }
}
