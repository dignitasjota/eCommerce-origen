/**
 * Cookie que vincula un pedido al navegador que lo creó, para que la página
 * /checkout/success/[orderId] pueda mostrarse a un comprador invitado (sin
 * sesión) sin quedar abierta a cualquiera que conozca la URL. Antes esa
 * página mostraba email, dirección e ítems de CUALQUIER pedido por su UUID —
 * y la URL acaba en historiales, logs de proxy y cabeceras Referer.
 */
export const ORDER_ACCESS_COOKIE = 'eshop_order_access';
const MAX_IDS = 5;

export function parseOrderAccessCookie(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split('.').filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, MAX_IDS);
}

export function buildOrderAccessCookie(existingRaw: string | undefined, orderId: string): string {
    const ids = [orderId, ...parseOrderAccessCookie(existingRaw).filter((id) => id !== orderId)].slice(0, MAX_IDS);
    return ids.join('.');
}

export const ORDER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
};
