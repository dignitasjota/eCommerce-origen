import { test, expect } from '@playwright/test';

/**
 * El banner RGPD es el primer punto de contacto del usuario. Si rompe, todos
 * los demás tests pueden fallar por contexto (ej. modal bloqueando clicks).
 */
test.describe('Cookie consent banner', () => {
    test.use({ storageState: { cookies: [], origins: [] } }); // sesión limpia

    test('aparece en la primera visita', async ({ page }) => {
        await page.goto('/');
        const banner = page.getByRole('dialog', { name: /consentimiento de cookies/i });
        await expect(banner).toBeVisible();
        // Las 3 acciones requeridas por la AEPD están al mismo nivel.
        await expect(page.getByRole('button', { name: /aceptar todo/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /sólo necesarias/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /personalizar/i })).toBeVisible();
    });

    test('al aceptar todo, el banner desaparece y persiste tras recargar', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /aceptar todo/i }).click();
        await expect(page.getByRole('dialog', { name: /consentimiento de cookies/i })).toBeHidden();

        const cookies = await page.context().cookies();
        const consent = cookies.find((c) => c.name === 'eshop_cookies_consent');
        expect(consent).toBeDefined();
        expect(consent?.value).toContain('analytics');

        await page.reload();
        await expect(page.getByRole('dialog', { name: /consentimiento de cookies/i })).toBeHidden();
    });

    test('rechazar es tan fácil como aceptar — sólo necesarias funciona en un click', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /sólo necesarias/i }).click();
        await expect(page.getByRole('dialog', { name: /consentimiento de cookies/i })).toBeHidden();

        const cookies = await page.context().cookies();
        const consent = cookies.find((c) => c.name === 'eshop_cookies_consent');
        expect(consent).toBeDefined();
        // El JSON contiene "analytics":false y "marketing":false.
        expect(consent?.value).toMatch(/analytics%22%3Afalse|"analytics":false/);
    });
});
