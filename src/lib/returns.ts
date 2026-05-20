import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

/**
 * Sistema de devoluciones (RMA — Return Merchandise Authorization).
 *
 * Estados:
 *   REQUESTED → APPROVED → RECEIVED → REFUNDED
 *           └→ REJECTED
 *           └→ CANCELLED (sólo el cliente, antes de APPROVED)
 *
 * Reglas de negocio:
 *   - Sólo se puede solicitar devolución de pedidos DELIVERED.
 *   - Hay una ventana configurable (default 14 días desde delivered_at);
 *     pasada la ventana, el endpoint rechaza la solicitud.
 *   - No se puede devolver más de la cantidad pedida (descontando devoluciones
 *     previas que no estén en estado REJECTED/CANCELLED).
 *   - El admin puede aprobar/rechazar una solicitud REQUESTED.
 *   - Al recibir mercancía (RECEIVED) se restituye el stock con
 *     `StockMovement(REFUND)`.
 *   - Al refundir (REFUNDED) se llama a Stripe `refunds.create` si la orden
 *     se pagó con Stripe (parcial = monto del refund_amount).
 */

export const RETURN_WINDOW_DAYS = 14;

/**
 * Genera un return_number no enumerable: `RMA-YYYYMM-XXXXXXXX`.
 */
export function generateReturnNumber(): string {
    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `RMA-${yyyymm}-${suffix}`;
}

/**
 * Calcula cuántas unidades de un OrderItem se pueden todavía devolver.
 * Resta las devoluciones existentes que NO estén en REJECTED/CANCELLED
 * (esos estados no consumen "cupo" porque no se procesaron).
 */
export async function getRemainingReturnableQty(
    db: Prisma.TransactionClient | typeof prisma,
    orderItemId: string
): Promise<number> {
    const orderItem = await db.orderItem.findUnique({
        where: { id: orderItemId },
        select: { quantity: true }
    });
    if (!orderItem) return 0;

    const previousReturns = await db.returnItem.findMany({
        where: {
            order_item_id: orderItemId,
            returns: { status: { notIn: ['REJECTED', 'CANCELLED'] } }
        },
        select: { quantity: true }
    });
    const alreadyReturned = previousReturns.reduce((acc, r) => acc + r.quantity, 0);

    return Math.max(0, orderItem.quantity - alreadyReturned);
}

/**
 * Valida que un pedido es elegible para devolución.
 * Lanza Error con mensaje legible si no.
 */
export async function assertOrderEligibleForReturn(
    db: Prisma.TransactionClient | typeof prisma,
    orderId: string,
    requestingUserId: string | null
): Promise<void> {
    const order = await db.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            user_id: true,
            status: true,
            payment_status: true,
            updated_at: true
        }
    });
    if (!order) throw new Error('Pedido no encontrado');

    // Sólo el dueño del pedido puede solicitar (admin tiene su propia ruta).
    if (requestingUserId && order.user_id !== requestingUserId) {
        throw new Error('No tienes permiso sobre este pedido');
    }

    if (order.status !== 'DELIVERED') {
        throw new Error('Sólo se pueden devolver pedidos entregados');
    }
    if (order.payment_status !== 'PAID') {
        throw new Error('Sólo se pueden devolver pedidos pagados');
    }

    // Ventana de devolución basada en updated_at (cuando se marcó DELIVERED).
    const ageMs = Date.now() - order.updated_at.getTime();
    const ageDays = ageMs / 86_400_000;
    if (ageDays > RETURN_WINDOW_DAYS) {
        throw new Error(`La ventana de devolución ha expirado (${RETURN_WINDOW_DAYS} días desde la entrega)`);
    }
}

/**
 * Transiciones permitidas. Usado tanto en la UI cliente como en el admin
 * para validar antes de mutar.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['RECEIVED', 'REJECTED'],
    RECEIVED: ['REFUNDED'],
    REJECTED: [],
    REFUNDED: [],
    CANCELLED: []
};

export function canTransition(from: string, to: string): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
