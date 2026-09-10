/** Umbral bajo el cual se muestra el aviso de urgencia "¡Solo quedan X!". */
export const LOW_STOCK_THRESHOLD = 5;

/** `stock` sólo es significativo cuando el producto/variante no tiene stock ilimitado. */
export function isLowStock(stock: number, unlimitedStock: boolean): boolean {
    return !unlimitedStock && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
}
