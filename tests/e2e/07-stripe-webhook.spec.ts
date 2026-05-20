import { test, expect } from '@playwright/test';
import { signStripePayload, buildStripeEvent } from './helpers/stripe-signature';

/**
 * Verifica el contrato del webhook de Stripe sin dependencia de claves reales:
 *
 *   1. Sin cabecera `stripe-signature` ⇒ 400.
 *   2. Con firma inválida ⇒ 400.
 *   3. Con firma válida + event nuevo ⇒ 200 (procesa, aunque la orden no exista
 *      en BD el handler tolera el caso sin crash).
 *   4. Con firma válida + event repetido ⇒ 200 con `duplicated: true`
 *      (idempotencia vía `WebhookEvent` UNIQUE).
 *
 * Requiere `STRIPE_WEBHOOK_SECRET` configurado como env del proceso de Next.
 * En CI, el workflow lo inyecta con un valor de test (`whsec_test_e2e_only`).
 * Si no está configurado, este test se salta (no es válido sin secret).
 */

const E2E_WEBHOOK_SECRET = process.env.E2E_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

test.describe('Webhook Stripe — contrato e idempotencia', () => {
    test.skip(!E2E_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET no configurado — skipped');

    test('rechaza POST sin cabecera stripe-signature', async ({ request }) => {
        const res = await request.post('/api/webhooks/stripe', {
            data: '{}',
            headers: { 'content-type': 'application/json' }
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/stripe-signature/i);
    });

    test('rechaza firma inválida', async ({ request }) => {
        const payload = JSON.stringify(buildStripeEvent('checkout.session.completed', { id: 'cs_test_x' }));
        const res = await request.post('/api/webhooks/stripe', {
            data: payload,
            headers: {
                'content-type': 'application/json',
                'stripe-signature': 't=123,v1=deadbeef'
            }
        });
        expect(res.status()).toBe(400);
    });

    test('procesa event nuevo y deduplica el reenvío', async ({ request }) => {
        // Event con id único para esta ejecución — evita colisión con runs previos.
        const eventId = `evt_test_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const event = buildStripeEvent(
            'checkout.session.completed',
            {
                id: 'cs_test_e2e',
                payment_status: 'paid',
                payment_intent: 'pi_test_e2e',
                metadata: { order_id: 'non-existent-order-id' } // handler tolera órdenes faltantes
            },
            eventId
        );
        const payload = JSON.stringify(event);
        const sig = signStripePayload(payload, E2E_WEBHOOK_SECRET!);

        // Primer POST: procesa.
        const first = await request.post('/api/webhooks/stripe', {
            data: payload,
            headers: { 'content-type': 'application/json', 'stripe-signature': sig }
        });
        expect(first.status()).toBe(200);
        const firstBody = await first.json();
        expect(firstBody.received).toBe(true);
        expect(firstBody.duplicated).toBeFalsy();

        // Segundo POST con el mismo event_id (firma re-generada): duplicate.
        // Stripe usa timestamps frescos en cada reintento, así que firmamos de nuevo.
        const sig2 = signStripePayload(payload, E2E_WEBHOOK_SECRET!);
        const second = await request.post('/api/webhooks/stripe', {
            data: payload,
            headers: { 'content-type': 'application/json', 'stripe-signature': sig2 }
        });
        expect(second.status()).toBe(200);
        const secondBody = await second.json();
        expect(secondBody.duplicated).toBe(true);
    });
});
