import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { recordStockMovement, type StockReason } from '@/lib/stock';

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Almacén por defecto para asignaciones que no dependen de disponibilidad de
 * stock (producto `unlimited_stock`, stock inicial al crear una variante,
 * restitución de pedidos anteriores a esta funcionalidad sin `warehouse_id`).
 * Criterio: el almacén activo con menor `priority` (empate → más antiguo).
 * `null` sólo puede ocurrir si no queda NINGÚN almacén activo — el bootstrap
 * (scripts/seed-bootstrap.mjs) garantiza que siempre exista al menos uno.
 */
export async function getDefaultWarehouseId(client: Client): Promise<string | null> {
    const warehouse = await client.warehouse.findFirst({
        where: { is_active: true },
        orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
        select: { id: true }
    });
    return warehouse?.id ?? null;
}

interface AllocateParams {
    variant_id: string;
    quantity: number;
    /** `false` cuando `Product.unlimited_stock` — no se comprueba ni decrementa nada. */
    enforceStock: boolean;
    reference_id: string;
    note?: string | null;
    user_id?: string | null;
}

/**
 * Asigna un almacén de origen para un ítem de checkout y, si procede,
 * decrementa su stock de forma atómica. Recorre los almacenes activos por
 * `priority` ascendente:
 *   - Si es de drop shipping (`is_dropshipping`), se asigna sin decrementar
 *     ningún contador local (capacidad virtual — el proveedor externo asume
 *     el riesgo de disponibilidad).
 *   - Si no, intenta `updateMany` con guardia `stock >= quantity` sobre
 *     `WarehouseStock` (mismo patrón atómico que el resto del proyecto).
 * Si ningún almacén puede cubrir la cantidad, lanza 'Stock insuficiente'
 * (el caller ya espera ese mensaje para convertirlo en HTTP 409).
 *
 * IMPORTANTE: no reparte una misma línea de pedido entre varios almacenes
 * (sin fulfillment partido) — límite documentado, ver ADR de multi-warehouse.
 */
export async function allocateAndDecrementStock(
    tx: Prisma.TransactionClient,
    { variant_id, quantity, enforceStock, reference_id, note, user_id }: AllocateParams
): Promise<{ warehouse_id: string | null }> {
    if (!enforceStock) {
        const warehouse_id = await getDefaultWarehouseId(tx);
        return { warehouse_id };
    }

    const warehouses = await tx.warehouse.findMany({
        where: { is_active: true },
        orderBy: [{ priority: 'asc' }, { created_at: 'asc' }]
    });

    for (const warehouse of warehouses) {
        if (warehouse.is_dropshipping) {
            await recordStockMovement(
                { variant_id, warehouse_id: warehouse.id, quantity: -quantity, reason: 'PURCHASE', reference_id, note, user_id },
                tx
            );
            return { warehouse_id: warehouse.id };
        }

        const result = await tx.warehouseStock.updateMany({
            where: { variant_id, warehouse_id: warehouse.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } }
        });
        if (result.count !== 1) continue;

        await tx.productVariant.update({ where: { id: variant_id }, data: { stock: { decrement: quantity } } });
        await recordStockMovement(
            { variant_id, warehouse_id: warehouse.id, quantity: -quantity, reason: 'PURCHASE', reference_id, note, user_id },
            tx
        );
        return { warehouse_id: warehouse.id };
    }

    throw new Error('Stock insuficiente');
}

interface RestockParams {
    variant_id: string;
    /** Almacén de origen del pedido (`OrderItem.warehouse_id`). `null` → se usa el almacén por defecto. */
    warehouse_id: string | null;
    quantity: number;
    reason: StockReason;
    reference_id?: string | null;
    note?: string | null;
    user_id?: string | null;
}

/**
 * Restituye stock a un almacén (cancelación, reembolso, devolución
 * recibida). Si el almacén asignado originalmente es de drop shipping, o si
 * ya no queda ningún almacén disponible, no hay contador local que tocar —
 * igualmente se registra el `StockMovement` para trazabilidad. Mantiene
 * sincronizado `ProductVariant.stock` (total cacheado) con `WarehouseStock`.
 */
export async function restockToWarehouse(
    tx: Prisma.TransactionClient,
    { variant_id, warehouse_id, quantity, reason, reference_id, note, user_id }: RestockParams
): Promise<void> {
    const targetWarehouseId = warehouse_id ?? (await getDefaultWarehouseId(tx));

    if (targetWarehouseId) {
        const warehouse = await tx.warehouse.findUnique({
            where: { id: targetWarehouseId },
            select: { is_dropshipping: true }
        });
        if (warehouse && !warehouse.is_dropshipping) {
            await tx.warehouseStock.upsert({
                where: { variant_id_warehouse_id: { variant_id, warehouse_id: targetWarehouseId } },
                create: { variant_id, warehouse_id: targetWarehouseId, stock: quantity },
                update: { stock: { increment: quantity } }
            });
            await tx.productVariant.update({ where: { id: variant_id }, data: { stock: { increment: quantity } } });
        }
    }

    await recordStockMovement(
        { variant_id, warehouse_id: targetWarehouseId, quantity, reason, reference_id, note, user_id },
        tx
    );
}

/**
 * Crea la fila `WarehouseStock` inicial de una variante recién creada, en el
 * almacén por defecto. No registra `StockMovement` — el caller (createVariant)
 * ya lo hace tras esta llamada, con el mismo `warehouse_id` devuelto aquí.
 */
export async function seedInitialWarehouseStock(
    tx: Prisma.TransactionClient,
    { variant_id, stock }: { variant_id: string; stock: number }
): Promise<{ warehouse_id: string | null }> {
    const warehouse_id = await getDefaultWarehouseId(tx);
    if (warehouse_id) {
        await tx.warehouseStock.create({ data: { variant_id, warehouse_id, stock } });
    }
    return { warehouse_id };
}

/**
 * Fija (valor absoluto, no delta) el stock de una variante en un almacén
 * concreto desde el admin. Calcula el delta contra el valor previo, lo
 * aplica también al total cacheado (`ProductVariant.stock`) y deja rastro en
 * `StockMovement` (RESTOCK si sube, ADJUSTMENT si baja) — mismo criterio que
 * el editor de variantes plano ya usaba antes de esta funcionalidad.
 */
export async function setWarehouseStock(params: {
    variant_id: string;
    warehouse_id: string;
    newStock: number;
    user_id?: string | null;
    note?: string | null;
}): Promise<void> {
    if (!Number.isInteger(params.newStock) || params.newStock < 0) {
        throw new Error('Stock inválido');
    }

    await prisma.$transaction(async (tx) => {
        const existing = await tx.warehouseStock.findUnique({
            where: { variant_id_warehouse_id: { variant_id: params.variant_id, warehouse_id: params.warehouse_id } }
        });
        const previousStock = existing?.stock ?? 0;
        const delta = params.newStock - previousStock;
        if (delta === 0) return;

        await tx.warehouseStock.upsert({
            where: { variant_id_warehouse_id: { variant_id: params.variant_id, warehouse_id: params.warehouse_id } },
            create: { variant_id: params.variant_id, warehouse_id: params.warehouse_id, stock: params.newStock },
            update: { stock: params.newStock }
        });
        await tx.productVariant.update({ where: { id: params.variant_id }, data: { stock: { increment: delta } } });
        await recordStockMovement(
            {
                variant_id: params.variant_id,
                warehouse_id: params.warehouse_id,
                quantity: delta,
                reason: delta > 0 ? 'RESTOCK' : 'ADJUSTMENT',
                note: params.note ?? 'Ajuste manual desde admin (stock por almacén)',
                user_id: params.user_id
            },
            tx
        );
    });
}
