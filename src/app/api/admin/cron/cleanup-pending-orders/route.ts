import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronAuth, CronAuthError } from '@/lib/cron-auth';
import { recordStockMovement } from '@/lib/stock';
import { auditLogServer } from '@/lib/audit';

/**
 * Cron de limpieza de órdenes `PENDING_PAYMENT` vencidas.
 *
 * Trigger recomendado: cada 5 minutos.
 *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
 *        https://tienda.cliente.com/api/admin/cron/cleanup-pending-orders
 *
 * Comportamiento:
 *   1. Selecciona órdenes con status='PENDING_PAYMENT' y created_at < now-30m.
 *   2. Por cada una, en transacción:
 *      - Suma el stock decrementado de vuelta a cada ProductVariant.
 *      - Decrementa coupon.used_count si la orden tenía cupón.
 *      - Marca la orden CANCELLED + payment_status FAILED.
 *      - Registra StockMovement RESERVATION_RELEASE por cada variante.
 *   3. Devuelve resumen JSON.
 *
 * Idempotente: si una orden ya está CANCELLED, no la toca.
 * Best-effort: si una orden falla en su transacción, se loguea y
 * continuamos con las siguientes — no abortamos todo el batch.
 */
export const dynamic = 'force-dynamic';

const TIMEOUT_MINUTES = 30;
const MAX_BATCH = 100; // tope por ejecución para no abrazar la BD

export async function POST(req: Request) {
    try {
        verifyCronAuth(req);
    } catch (e) {
        if (e instanceof CronAuthError) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        throw e;
    }

    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60_000);

    const candidates = await prisma.order.findMany({
        where: {
            status: 'PENDING_PAYMENT',
            created_at: { lt: cutoff }
        },
        include: {
            order_items: { select: { id: true, variant_id: true, quantity: true, name: true } }
        },
        take: MAX_BATCH,
        orderBy: { created_at: 'asc' }
    });

    let cleaned = 0;
    const failures: Array<{ orderId: string; error: string }> = [];

    for (const order of candidates) {
        try {
            await prisma.$transaction(async (tx) => {
                // 1. Restituir stock: incrementar la variante por la cantidad pedida.
                //    Sólo lo hacemos para ítems con variant_id (los unlimited_stock
                //    no decrementaron, así que tampoco hay que reponer).
                for (const item of order.order_items) {
                    if (!item.variant_id) continue;
                    await tx.productVariant.update({
                        where: { id: item.variant_id },
                        data: { stock: { increment: item.quantity } }
                    });
                    await recordStockMovement(
                        {
                            variant_id: item.variant_id,
                            quantity: item.quantity,
                            reason: 'RESERVATION_RELEASE',
                            reference_id: order.id,
                            note: `Order ${order.order_number} expired`
                        },
                        tx
                    );
                }

                // 2. Decrementar `used_count` del cupón si aplica.
                if (order.coupon_id) {
                    await tx.coupon.update({
                        where: { id: order.coupon_id },
                        data: { used_count: { decrement: 1 } }
                    });
                }

                // 3. Marcar la orden CANCELLED.
                await tx.order.update({
                    where: { id: order.id, status: 'PENDING_PAYMENT' }, // guard idempotencia
                    data: {
                        status: 'CANCELLED',
                        payment_status: 'FAILED'
                    }
                });
            });

            await auditLogServer({
                action: 'order.cleanup_expired',
                entity_type: 'Order',
                entity_id: order.id,
                metadata: { order_number: order.order_number, items: order.order_items.length }
            });
            cleaned++;
        } catch (e: any) {
            failures.push({ orderId: order.id, error: e?.message || 'unknown' });
            console.error(`[cleanup-pending] failed ${order.id}:`, e?.message);
        }
    }

    return NextResponse.json({
        ok: true,
        cutoff: cutoff.toISOString(),
        candidates: candidates.length,
        cleaned,
        failures
    });
}
