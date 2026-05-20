import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';

export type StockReason = 'PURCHASE' | 'REFUND' | 'ADJUSTMENT' | 'RESTOCK' | 'RESERVATION_RELEASE';

export interface StockMovementInput {
    variant_id: string;
    /** Positivo = entrada (RESTOCK/REFUND), negativo = salida (PURCHASE). */
    quantity: number;
    reason: StockReason;
    /** Referencia opcional (id de orden, id de devolución…) para trazar. */
    reference_id?: string | null;
    note?: string | null;
    user_id?: string | null;
}

/**
 * Registra un movimiento de stock en `stock_movements`. Best-effort:
 * loguea pero no lanza si falla — el inventario "real" vive en
 * `ProductVariant.stock`, este log es para auditoría y reportes.
 *
 * Acepta opcionalmente un `tx` (cliente de transacción Prisma) para que
 * el movimiento se inserte dentro de la misma transacción que el cambio
 * de stock — si la transacción hace rollback, el log también desaparece.
 */
export async function recordStockMovement(
    input: StockMovementInput,
    tx?: Prisma.TransactionClient
): Promise<void> {
    if (!Number.isInteger(input.quantity) || input.quantity === 0) {
        // Movimiento de 0 unidades es un no-op — no llenar la tabla.
        return;
    }
    const client = tx ?? prisma;
    try {
        await client.stockMovement.create({
            data: {
                variant_id: input.variant_id,
                quantity: input.quantity,
                reason: input.reason,
                reference_id: input.reference_id ?? null,
                note: input.note ? input.note.slice(0, 255) : null,
                user_id: input.user_id ?? null
            }
        });
    } catch (e) {
        console.error('[stock] failed to record movement:', (e as Error)?.message);
    }
}
