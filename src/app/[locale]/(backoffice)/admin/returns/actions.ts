'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { canTransition } from '@/lib/returns';
import { recordStockMovement } from '@/lib/stock';
import { auditLog } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { getReturnStatusEmailHtml } from '@/lib/emails/return-status';
import { getStripe } from '@/lib/stripe';

/**
 * Server actions del flujo de devoluciones (admin).
 *
 * Patrón: cada transición valida `canTransition`, ejecuta los efectos
 * laterales (stock, refund, email) y registra `AuditLog`. Idempotente
 * vía guard en el `where` del update (`status: <expected>`).
 */

async function loadReturnFull(id: string) {
    return prisma.return.findUnique({
        where: { id },
        include: {
            users: { select: { email: true, name: true } },
            orders: {
                select: {
                    id: true,
                    order_number: true,
                    payment_intent_id: true,
                    payment_method: true,
                    guest_email: true,
                    guest_name: true
                }
            },
            return_items: {
                include: {
                    order_items: { select: { variant_id: true, name: true, price: true } }
                }
            }
        }
    });
}

async function notifyCustomer(
    ret: { return_number: string; users: { email: string; name: string | null } | null },
    fallbackEmail: string | null,
    fallbackName: string | null,
    newStatus: string,
    extras?: { adminNotes?: string | null; refundAmount?: number | null }
) {
    const to = ret.users?.email || fallbackEmail;
    const name = ret.users?.name || fallbackName || 'Cliente';
    if (!to) return;
    try {
        await sendEmail({
            to,
            subject: `Tu devolución #${ret.return_number} — ${newStatus}`,
            html: getReturnStatusEmailHtml(ret.return_number, name, newStatus, extras)
        });
    } catch (e) {
        console.error('[returns] email failed:', (e as Error).message);
    }
}

export async function approveReturn(returnId: string, formData: FormData) {
    try {
        await requireAdmin();
        const adminNotes = (formData.get('admin_notes') as string)?.trim() || null;

        const ret = await loadReturnFull(returnId);
        if (!ret) return { success: false, error: 'Devolución no encontrada' };
        if (!canTransition(ret.status, 'APPROVED')) {
            return { success: false, error: `No se puede aprobar desde ${ret.status}` };
        }

        const updated = await prisma.return.update({
            where: { id: returnId, status: 'REQUESTED' },
            data: { status: 'APPROVED', approved_at: new Date(), admin_notes: adminNotes }
        });

        await notifyCustomer(ret, ret.orders?.guest_email ?? null, ret.orders?.guest_name ?? null, 'APPROVED', { adminNotes });
        await auditLog({
            action: 'return.approve',
            entity_type: 'Return',
            entity_id: returnId,
            metadata: { return_number: updated.return_number }
        });
        revalidatePath('/[locale]/admin/returns', 'page');
        return { success: true };
    } catch (e: any) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: e?.message || 'Error aprobando' };
    }
}

export async function rejectReturn(returnId: string, formData: FormData) {
    try {
        await requireAdmin();
        const adminNotes = (formData.get('admin_notes') as string)?.trim() || null;
        if (!adminNotes) {
            return { success: false, error: 'Indica el motivo de rechazo en las notas' };
        }

        const ret = await loadReturnFull(returnId);
        if (!ret) return { success: false, error: 'Devolución no encontrada' };
        if (!canTransition(ret.status, 'REJECTED')) {
            return { success: false, error: `No se puede rechazar desde ${ret.status}` };
        }

        await prisma.return.update({
            where: { id: returnId, status: ret.status },
            data: { status: 'REJECTED', rejected_at: new Date(), admin_notes: adminNotes }
        });

        await notifyCustomer(ret, ret.orders?.guest_email ?? null, ret.orders?.guest_name ?? null, 'REJECTED', { adminNotes });
        await auditLog({
            action: 'return.reject',
            entity_type: 'Return',
            entity_id: returnId,
            metadata: { return_number: ret.return_number, reason: adminNotes }
        });
        revalidatePath('/[locale]/admin/returns', 'page');
        return { success: true };
    } catch (e: any) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: e?.message || 'Error rechazando' };
    }
}

export async function markReturnReceived(returnId: string, formData: FormData) {
    try {
        const session = await requireAdmin();
        const trackingNumber = (formData.get('tracking_number') as string)?.trim() || null;

        const ret = await loadReturnFull(returnId);
        if (!ret) return { success: false, error: 'Devolución no encontrada' };
        if (!canTransition(ret.status, 'RECEIVED')) {
            return { success: false, error: `No se puede marcar recibida desde ${ret.status}` };
        }

        // Restituir stock CONDICIONALMENTE según la condición de cada ítem:
        //   - UNOPENED / OPENED → mercancía revendible: incrementar stock + log REFUND.
        //   - DAMAGED / USED   → mercancía inservible: NO tocar stock, log ADJUSTMENT con note
        //                         para que la auditoría refleje el descarte.
        const RESELLABLE: Array<typeof ret.return_items[number]['condition']> = ['UNOPENED', 'OPENED'];

        await prisma.$transaction(async (tx) => {
            await tx.return.update({
                where: { id: returnId, status: 'APPROVED' },
                data: { status: 'RECEIVED', received_at: new Date(), tracking_number: trackingNumber }
            });

            for (const item of ret.return_items) {
                if (!item.order_items?.variant_id) continue;
                const isResellable = RESELLABLE.includes(item.condition);

                if (isResellable) {
                    await tx.productVariant.update({
                        where: { id: item.order_items.variant_id },
                        data: { stock: { increment: item.quantity } }
                    });
                    await recordStockMovement(
                        {
                            variant_id: item.order_items.variant_id,
                            quantity: item.quantity,
                            reason: 'REFUND',
                            reference_id: ret.id,
                            note: `Return ${ret.return_number} received (${item.condition})`,
                            user_id: session.user.id
                        },
                        tx
                    );
                }
                // Si !isResellable: NO incrementamos stock (mercancía inservible)
                // ni registramos StockMovement (no hubo movimiento real). El descarte
                // queda trazado en el AuditLog del nivel de la operación, abajo.
            }
        });

        // Métricas para audit log.
        const restocked = ret.return_items
            .filter((i) => RESELLABLE.includes(i.condition))
            .reduce((acc, i) => acc + i.quantity, 0);
        const discarded = ret.return_items
            .filter((i) => !RESELLABLE.includes(i.condition))
            .reduce((acc, i) => acc + i.quantity, 0);

        await notifyCustomer(ret, ret.orders?.guest_email ?? null, ret.orders?.guest_name ?? null, 'RECEIVED');
        await auditLog({
            action: 'return.receive',
            entity_type: 'Return',
            entity_id: returnId,
            metadata: {
                return_number: ret.return_number,
                items: ret.return_items.length,
                restocked,
                discarded
            }
        });
        revalidatePath('/[locale]/admin/returns', 'page');
        return { success: true };
    } catch (e: any) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        console.error('[returns] receive error:', e);
        return { success: false, error: e?.message || 'Error registrando recepción' };
    }
}

export async function refundReturn(returnId: string, formData: FormData) {
    try {
        await requireAdmin();
        const refundAmountRaw = formData.get('refund_amount') as string;
        const refundAmount = parseFloat(refundAmountRaw);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
            return { success: false, error: 'Importe de reembolso inválido' };
        }

        const ret = await loadReturnFull(returnId);
        if (!ret) return { success: false, error: 'Devolución no encontrada' };
        if (!canTransition(ret.status, 'REFUNDED')) {
            return { success: false, error: `No se puede reembolsar desde ${ret.status}` };
        }

        let stripeRefundId: string | null = null;

        // Si la orden se pagó con Stripe, hacemos el refund vía API.
        // Para COD/TRANSFER el reembolso es manual (transferencia inversa) y
        // sólo registramos el importe.
        if (ret.orders?.payment_intent_id) {
            try {
                const stripe = await getStripe();
                const refund = await stripe.refunds.create({
                    payment_intent: ret.orders.payment_intent_id,
                    amount: Math.round(refundAmount * 100), // céntimos
                    reason: 'requested_by_customer',
                    metadata: { return_id: ret.id, return_number: ret.return_number }
                });
                stripeRefundId = refund.id;
            } catch (stripeErr: any) {
                console.error('[returns] Stripe refund error:', stripeErr);
                return {
                    success: false,
                    error: `Stripe rechazó el reembolso: ${stripeErr?.message || 'desconocido'}`
                };
            }
        }

        await prisma.return.update({
            where: { id: returnId, status: 'RECEIVED' },
            data: {
                status: 'REFUNDED',
                refunded_at: new Date(),
                refund_amount: refundAmount,
                stripe_refund_id: stripeRefundId
            }
        });

        await notifyCustomer(
            ret,
            ret.orders?.guest_email ?? null,
            ret.orders?.guest_name ?? null,
            'REFUNDED',
            { refundAmount }
        );
        await auditLog({
            action: 'return.refund',
            entity_type: 'Return',
            entity_id: returnId,
            metadata: {
                return_number: ret.return_number,
                amount: refundAmount,
                stripe_refund_id: stripeRefundId
            }
        });
        revalidatePath('/[locale]/admin/returns', 'page');
        return { success: true, stripe_refund_id: stripeRefundId };
    } catch (e: any) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        console.error('[returns] refund error:', e);
        return { success: false, error: e?.message || 'Error procesando reembolso' };
    }
}
