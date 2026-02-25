'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import { getOrderStatusUpdateEmailHtml } from '@/lib/emails/order-status-update';

export async function updateOrderFullStatus(formData: FormData) {
    try {
        const id = formData.get('orderId') as string;
        const newStatus = formData.get('status') as string;
        const newPaymentStatus = formData.get('paymentStatus') as string;

        if (!id || !newStatus || !newPaymentStatus) {
            return { success: false, error: 'Datos incompletos' };
        }

        // Obtener el estado anterior para saber si ha cambiado
        const order = await prisma.order.findUnique({
            where: { id },
            include: { users: true }
        });

        if (!order) return { success: false, error: 'Pedido no encontrado' };

        // Actualizar en base de datos
        await prisma.order.update({
            where: { id },
            data: {
                status: newStatus as any,
                payment_status: newPaymentStatus as any
            }
        });

        // 📧 Enviar Email al Cliente SOLO si el estado global del pedido ha cambiado
        if (newStatus !== order.status) {
            try {
                const customerEmail = order.users?.email || order.guest_email;
                const customerName = order.users?.name || order.guest_name || 'Cliente';

                if (customerEmail) {
                    await sendEmail({
                        to: customerEmail,
                        subject: `Actualización de tu Pedido #${order.order_number}`,
                        html: getOrderStatusUpdateEmailHtml(order.order_number || '', customerName, newStatus)
                    });
                }
            } catch (emailError) {
                console.error('Error al enviar email de actualización de estado:', emailError);
            }
        }

        revalidatePath(`/es/admin/orders/${id}`);
        revalidatePath(`/en/admin/orders/${id}`);
        revalidatePath(`/es/admin/orders`);
        revalidatePath(`/en/admin/orders`);

        return { success: true };
    } catch (error: any) {
        console.error("Error updating order status:", error);
        return { success: false, error: 'Fallo interno del servidor.' };
    }
}
