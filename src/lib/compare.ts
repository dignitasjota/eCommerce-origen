/**
 * Constante compartida entre `CompareContext.tsx` (cliente) y la API de
 * comparación (servidor). Vive en un módulo sin `'use client'` a propósito:
 * importar un export desde un módulo marcado `'use client'` en código de
 * servidor lo convierte en una referencia de cliente, no en el valor real
 * — un número aquí dejaría de comportarse como número.
 */
export const MAX_COMPARE_ITEMS = 4;
