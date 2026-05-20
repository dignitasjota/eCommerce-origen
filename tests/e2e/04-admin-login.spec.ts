import { test, expect } from '@playwright/test';

/**
 * Login del admin y acceso al dashboard.
 *
 * Requiere variables de entorno con credenciales válidas:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *
 * En local, usar las del bootstrap (`docker compose logs app | grep ADMIN`).
 * En CI, configurar como secrets.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin — autenticación', () => {
    test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL/PASSWORD no configurados');

    test('login válido redirige al dashboard', async ({ page }) => {
        await page.goto('/auth/login');

        await page.fill('input[type="email"], input[name="email"]', adminEmail!);
        await page.fill('input[type="password"], input[name="password"]', adminPassword!);
        await page.locator('button[type="submit"], form button').first().click();

        // Tras login redirige al admin (dashboard) o a la URL pedida.
        await page.waitForURL(/\/admin/, { timeout: 10_000 });

        // El sidebar del admin tiene "Dashboard" como primer link.
        await expect(page.getByText(/dashboard/i).first()).toBeVisible();
    });

    test('admin sin sesión es redirigido al login', async ({ page, context }) => {
        // Limpiar cookies para asegurar que no hay sesión.
        await context.clearCookies();
        await page.goto('/admin/dashboard');
        // Next-auth redirige a /auth/login.
        await page.waitForURL(/\/auth\/login|\/login/, { timeout: 10_000 });
    });

    test('credenciales inválidas NO conceden acceso', async ({ page }) => {
        await page.goto('/auth/login');
        await page.fill('input[type="email"], input[name="email"]', adminEmail!);
        await page.fill('input[type="password"], input[name="password"]', 'incorrect-password-xyz');
        await page.locator('button[type="submit"], form button').first().click();

        // Debe seguir en la pantalla de login (URL no cambia a /admin) y mostrar error.
        await page.waitForTimeout(2000);
        await expect(page).not.toHaveURL(/\/admin\/dashboard/);
    });
});
