/**
 * URL pública de la tienda para construir enlaces que salen por email
 * (reset de contraseña, confirmaciones…). SIEMPRE desde configuración,
 * nunca desde las cabeceras `Host`/`X-Forwarded-*` de la petición: esas las
 * controla quien hace la petición, y un atacante podía conseguir que el
 * email de reset de una víctima apuntara a su dominio (host header
 * injection) y robar el token.
 *
 * El fallback a cabeceras sólo existe para desarrollo local sin variables.
 */
export function getPublicAppUrl(req?: Request): string {
    const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (configured) return configured.replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXT_PUBLIC_APP_URL no configurada — no se pueden generar enlaces públicos');
    }
    const host = req?.headers.get('host') || 'localhost:3000';
    return `http://${host}`;
}
