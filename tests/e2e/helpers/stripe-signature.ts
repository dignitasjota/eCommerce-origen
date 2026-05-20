import { createHmac } from 'crypto';

/**
 * Genera la cabecera `stripe-signature` que Stripe envía con sus webhooks.
 *
 * Formato:
 *   t=<unix_timestamp>,v1=<hmac_sha256(timestamp + "." + payload, secret)>
 *
 * No depende del SDK de stripe — usa sólo Node crypto, así el spec puede
 * correr en CI sin claves Stripe reales.
 *
 * Usar como:
 *   const sig = signStripePayload(JSON.stringify(event), secret);
 *   await fetch('/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': sig }, body: payload });
 */
export function signStripePayload(payload: string, secret: string, timestamp?: number): string {
    const t = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${t}.${payload}`;
    const v1 = createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `t=${t},v1=${v1}`;
}

/**
 * Construye un evento Stripe mínimo válido del tipo solicitado.
 *
 * Usar `data` para sobrescribir el objeto interno (ej. una Session con metadata).
 */
export function buildStripeEvent(type: string, data: Record<string, unknown>, id?: string) {
    return {
        id: id ?? `evt_test_${Math.random().toString(36).slice(2, 12)}`,
        object: 'event',
        api_version: '2024-11-20.acacia',
        created: Math.floor(Date.now() / 1000),
        data: { object: data },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
        type
    };
}
