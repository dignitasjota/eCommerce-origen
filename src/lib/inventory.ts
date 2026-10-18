/** Umbral bajo el cual se muestra el aviso de urgencia "¡Solo quedan X!". */
export const LOW_STOCK_THRESHOLD = 5;

/** `stock` sólo es significativo cuando el producto/variante no tiene stock ilimitado. */
export function isLowStock(stock: number, unlimitedStock: boolean): boolean {
    return !unlimitedStock && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
}

/**
 * Datos para el botón "Añadir al carrito" rápido de las tarjetas de listado.
 * Recibe las variantes ACTIVAS del producto:
 *   - 1 variante  → se añade directamente con su `variantId` (el checkout la
 *     necesita para asignar almacén y descontar stock).
 *   - >1 variante → `requiresOptions`: el botón lleva a la ficha para elegir.
 */
export function getQuickAddInfo(activeVariants: { id: string }[]): { variantId: string | null; requiresOptions: boolean } {
    if (activeVariants.length === 1) return { variantId: activeVariants[0].id, requiresOptions: false };
    return { variantId: null, requiresOptions: activeVariants.length > 1 };
}
