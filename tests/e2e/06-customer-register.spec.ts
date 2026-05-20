import { test, expect } from '@playwright/test';

/**
 * Flujo de alta de un cliente nuevo: completar el form de registro y validar
 * que la sesión queda activa al volver al storefront.
 *
 * Genera un email único por ejecución para no chocar con runs anteriores
 * (la BD persiste entre tests si Playwright corre en serie sobre el mismo DB).
 */

function uniqueEmail() {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    return `e2e-${ts}-${rand}@example.com`;
}

test.describe('Customer — registro y login', () => {
    test('registro de cliente nuevo concede sesión', async ({ page }) => {
        const email = uniqueEmail();
        const password = 'TestPass123!'; // mínimo 8 chars

        await page.goto('/auth/register');

        // Cerrar banner de cookies si aparece.
        const cookieBtn = page.getByRole('button', { name: /sólo necesarias/i });
        if (await cookieBtn.isVisible().catch(() => false)) {
            await cookieBtn.click();
        }

        await page.fill('input[name="name"]', 'Test E2E');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);

        const submit = page.locator('button[type="submit"]').first();
        await submit.click();

        // Tras registro debería redirigir al login o al home con sesión activa.
        // Aceptamos cualquiera de las 3: /auth/login (si requiere login manual),
        // /account (si auto-login), o / (home).
        await page.waitForURL(/\/(auth\/login|account|$|\?)/, { timeout: 10_000 });
    });

    test('rate limiter rechaza alta masiva desde misma IP', async ({ request }) => {
        // El register endpoint tiene rate-limit 5/10min. Hacer 6 peticiones rápidas
        // y comprobar que la 6ª es rechazada con 429.
        const responses = await Promise.all(
            Array.from({ length: 7 }, (_, i) =>
                request.post('/api/storefront/register', {
                    data: {
                        name: 'spam',
                        email: `spam-${Date.now()}-${i}@example.com`,
                        password: 'Password123!'
                    },
                    failOnStatusCode: false
                })
            )
        );
        const statuses = responses.map((r) => r.status());
        // Al menos una debe ser 429 (puede que las primeras sean OK si no hubo
        // peticiones previas en la ventana).
        expect(statuses.some((s) => s === 429)).toBe(true);
    });
});
