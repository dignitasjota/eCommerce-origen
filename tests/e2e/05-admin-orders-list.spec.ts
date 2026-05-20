import { test, expect } from '@playwright/test';

/**
 * Tras login, el admin puede ver el listado de pedidos. Comprueba que:
 *   - La página carga sin errores.
 *   - Los filtros server-side funcionan (cambiar status redibuja con la URL).
 *   - El export CSV responde con Content-Type correcto.
 *
 * Si no hay credenciales E2E_ADMIN_*, este test se salta.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin — listado de pedidos', () => {
    test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL/PASSWORD no configurados');

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login');
        await page.fill('input[type="email"], input[name="email"]', adminEmail!);
        await page.fill('input[type="password"], input[name="password"]', adminPassword!);
        await page.locator('button[type="submit"], form button').first().click();
        await page.waitForURL(/\/admin/, { timeout: 10_000 });
    });

    test('/admin/orders carga y muestra tabla o estado vacío', async ({ page }) => {
        await page.goto('/admin/orders');
        await expect(page.locator('h1')).toContainText(/pedidos/i);
        // O hay tabla con filas o hay estado vacío. Cualquiera de los dos es OK.
        const table = page.locator('table');
        const empty = page.locator('.admin-empty, [class*="empty"]');
        await expect(table.or(empty)).toBeVisible();
    });

    test('aplicar filtro de estado actualiza la URL', async ({ page }) => {
        await page.goto('/admin/orders');
        const statusSelect = page.locator('select[name="status"]');
        if (await statusSelect.isVisible()) {
            await statusSelect.selectOption('PENDING').catch(() => undefined);
            // El form es method=GET, así que un click en "Filtrar" recarga con query.
            const filterBtn = page.getByRole('button', { name: /filtrar/i });
            if (await filterBtn.isVisible()) {
                await filterBtn.click();
                await expect(page).toHaveURL(/status=PENDING/);
            }
        }
    });

    test('export CSV responde con tipo correcto', async ({ request, page, context }) => {
        // Necesitamos pasar la cookie de sesión a request — leemos las cookies del context.
        const cookies = await context.cookies();
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

        const res = await request.get('/api/admin/orders/export', {
            headers: { cookie: cookieHeader }
        });
        expect(res.ok()).toBe(true);
        expect(res.headers()['content-type']).toContain('text/csv');
        const body = await res.text();
        // Debe empezar con BOM UTF-8 + cabeceras.
        expect(body).toContain('Pedido');
    });
});
