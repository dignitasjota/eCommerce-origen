import Stripe from 'stripe';
import prisma from '@/lib/db';

/**
 * Cliente Stripe leyendo claves desde la BD (`SiteSettings`).
 *
 * Diseño: la plantilla se despliega "vacía" (sin Stripe configurado). El
 * dueño de la tienda introduce sus claves desde `/admin/payments` o
 * `/admin/settings`. Las env vars `STRIPE_SECRET_KEY` y
 * `STRIPE_WEBHOOK_SECRET` siguen funcionando como fallback para entornos
 * que prefieran inyectarlas vía Docker secrets, K8s, etc.
 *
 * Cache en memoria con TTL: cada 60 s revalidamos contra DB. Cambiar la
 * clave desde el panel admin tarda como mucho 1 min en propagarse al
 * cliente vivo. Reiniciar el contenedor lo hace inmediato.
 */

interface StripeConfig {
    secretKey: string;
    webhookSecret: string;
}

let _stripe: Stripe | null = null;
let _cachedConfig: StripeConfig | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadConfig(): Promise<StripeConfig | null> {
    const now = Date.now();
    if (_cachedConfig && now - _cachedAt < CACHE_TTL_MS) return _cachedConfig;

    // Fallback inmediato si las env vars existen — útil para CI/local dev.
    const envSecret = process.env.STRIPE_SECRET_KEY;
    const envWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    let secretKey = envSecret || '';
    let webhookSecret = envWebhook || '';

    try {
        const settings = await prisma.siteSetting.findMany({
            where: { key: { in: ['stripe_secret_key', 'stripe_webhook_secret'] } }
        });
        for (const s of settings) {
            if (s.key === 'stripe_secret_key' && s.value) secretKey = s.value;
            if (s.key === 'stripe_webhook_secret' && s.value) webhookSecret = s.value;
        }
    } catch {
        // Si la BD no responde aún (arranque), nos quedamos con env.
    }

    if (!secretKey) {
        _cachedConfig = null;
        _cachedAt = now;
        return null;
    }

    _cachedConfig = { secretKey, webhookSecret };
    _cachedAt = now;
    // Si la secret key cambió, invalidar el cliente.
    if (_stripe && (_stripe as any)._config?.secretKey !== secretKey) {
        _stripe = null;
    }
    return _cachedConfig;
}

export async function getStripe(): Promise<Stripe> {
    const config = await loadConfig();
    if (!config) {
        throw new Error('Stripe no está configurado. Define las claves en /admin/settings o en STRIPE_SECRET_KEY.');
    }
    if (!_stripe) {
        _stripe = new Stripe(config.secretKey, { typescript: true });
        // Marca privada para detectar cambios de clave.
        (_stripe as any)._config = { secretKey: config.secretKey };
    }
    return _stripe;
}

/**
 * Devuelve el webhook secret (string) o `null` si no está configurado.
 * Llamado por el handler del webhook ANTES de procesar nada.
 */
export async function getStripeWebhookSecret(): Promise<string | null> {
    const config = await loadConfig();
    return config?.webhookSecret || null;
}

/**
 * Versión síncrona conservada para compatibilidad con código existente.
 * @deprecated Usa `getStripe()` async — esta variante asume env vars.
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/** Métodos de pago que requieren redirección a la pasarela Stripe. */
export const STRIPE_PAYMENT_METHODS = ['STRIPE', 'CARD'] as const;
export type StripePaymentMethod = (typeof STRIPE_PAYMENT_METHODS)[number];

export function isStripePaymentMethod(method: string): method is StripePaymentMethod {
    return (STRIPE_PAYMENT_METHODS as readonly string[]).includes(method);
}

/** ¿Está Stripe configurado en este momento? */
export async function isStripeConfigured(): Promise<boolean> {
    const config = await loadConfig();
    return !!config;
}
