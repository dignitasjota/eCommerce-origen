/**
 * Set fijo de permisos delegables a usuarios `ORDER_MANAGER`. Vive en un
 * módulo sin `'use client'` (importable desde servidor y cliente sin
 * riesgo — ver la lección de `src/lib/compare.ts`: un export de un módulo
 * `'use client'` importado desde código de servidor deja de ser el valor
 * real).
 *
 * `settings`, `users` y `payments` quedan deliberadamente FUERA de este
 * set: son las áreas más sensibles (claves Stripe/SMTP, gestión de roles —
 * delegar `users` permitiría a un ORDER_MANAGER auto-promocionarse a
 * ADMIN), así que siguen exigiendo `role === 'ADMIN'` sin excepción,
 * igual que antes de este sistema de permisos.
 */
export const PERMISSIONS = [
    'products.manage',
    'categories.manage',
    'orders.manage',
    'returns.manage',
    'reviews.manage',
    'coupons.manage',
    'shipping.manage',
    'pages.manage',
    'blog.manage',
    'legal.manage',
    'audit_logs.view'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
    'products.manage': 'Productos',
    'categories.manage': 'Categorías',
    'orders.manage': 'Pedidos',
    'returns.manage': 'Devoluciones',
    'reviews.manage': 'Reseñas',
    'coupons.manage': 'Cupones',
    'shipping.manage': 'Envíos',
    'pages.manage': 'Páginas',
    'blog.manage': 'Blog',
    'legal.manage': 'Legal',
    'audit_logs.view': 'Auditoría (solo lectura)'
};

/**
 * Permisos que tiene un ORDER_MANAGER cuando `User.permissions` es `null`
 * (nunca se ha personalizado). Reproduce EXACTAMENTE el comportamiento
 * previo a este sistema (roles fijos: products/orders/returns/reviews/
 * pages/blog eran accesibles por defecto para ORDER_MANAGER;
 * categories/coupons/shipping/legal/audit_logs eran ADMIN-only) — así
 * ninguna cuenta ORDER_MANAGER existente pierde ni gana acceso al
 * desplegar este cambio.
 */
export const DEFAULT_ORDER_MANAGER_PERMISSIONS: Permission[] = [
    'products.manage',
    'orders.manage',
    'returns.manage',
    'reviews.manage',
    'pages.manage',
    'blog.manage'
];

export function isPermission(value: unknown): value is Permission {
    return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}
