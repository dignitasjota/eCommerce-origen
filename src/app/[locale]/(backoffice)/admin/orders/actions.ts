'use server';

import type { OrderStatus, orders_payment_status } from '@prisma/client';
import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sendOrderStatusEmail } from '@/lib/emails/notify';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { awardPointsForOrder } from '@/lib/loyalty';

export async function updateOrderFullStatus(formData: FormData) {
    try {
        await requireAdmin(undefined, 'orders.manage');
        const id = formData.get('orderId') as string;
        const newStatus = formData.get('status') as OrderStatus;
        const newPaymentStatus = formData.get('paymentStatus') as orders_payment_status;

        if (!id || !newStatus || !newPaymentStatus) {
            return { success: false, error: 'Datos incompletos' };
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { users: true }
        });
        if (!order) return { success: false, error: 'Pedido no encontrado' };

        // `delivered_at` se fija SOLO en la transición hacia DELIVERED (no en
        // cada resave mientras ya está DELIVERED) — es la base de la ventana
        // de devolución (RETURN_WINDOW_DAYS en src/lib/returns.ts). Si se
        // sobrescribiera en cada edición, cualquier cambio posterior de la
        // orden (tracking, notas...) reiniciaría la ventana silenciosamente.
        const enteringDelivered = order.status !== 'DELIVERED' && newStatus === 'DELIVERED';
        const enteringPaid = order.payment_status !== 'PAID' && newPaymentStatus === 'PAID';

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.order.update({
                where: { id },
                data: {
                    status: newStatus,
                    payment_status: newPaymentStatus,
                    ...(enteringDelivered ? { delivered_at: new Date() } : {})
                },
                include: { users: true }
            });

            if (enteringPaid) {
                await awardPointsForOrder(tx, id, order.user_id, Number(result.total));
            }

            return result;
        });

        // El helper notifica sólo si hubo cambio efectivo y el estado lo permite.
        await sendOrderStatusEmail(updated, {
            previousStatus: order.status,
            previousPaymentStatus: order.payment_status
        });

        await auditLog({
            action: 'order.update_status',
            entity_type: 'Order',
            entity_id: id,
            metadata: {
                order_number: order.order_number,
                from_status: order.status,
                to_status: newStatus,
                from_payment: order.payment_status,
                to_payment: newPaymentStatus
            }
        });

        revalidatePath(`/es/admin/orders/${id}`);
        revalidatePath(`/en/admin/orders/${id}`);
        revalidatePath(`/es/admin/orders`);
        revalidatePath(`/en/admin/orders`);

        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthorizationError) {
            return { success: false, error: error.message };
        }
        console.error("Error updating order status:", error);
        return { success: false, error: 'Fallo interno del servidor.' };
    }
}
