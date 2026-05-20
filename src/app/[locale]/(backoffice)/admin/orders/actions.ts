'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sendOrderStatusEmail } from '@/lib/emails/notify';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';

export async function updateOrderFullStatus(formData: FormData) {
    try {
        await requireAdmin();
        const id = formData.get('orderId') as string;
        const newStatus = formData.get('status') as string;
        const newPaymentStatus = formData.get('paymentStatus') as string;

        if (!id || !newStatus || !newPaymentStatus) {
            return { success: false, error: 'Datos incompletos' };
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { users: true }
        });
        if (!order) return { success: false, error: 'Pedido no encontrado' };

        const updated = await prisma.order.update({
            where: { id },
            data: {
                status: newStatus as any,
                payment_status: newPaymentStatus as any
            },
            include: { users: true }
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
