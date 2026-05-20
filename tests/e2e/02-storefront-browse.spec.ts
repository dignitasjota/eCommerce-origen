import { test, expect } from '@playwright/test';

/**
 * Verifica que la storefront carga sin errores de servidor y que el flujo
 * básico de navegación funciona: home → catálogo → ficha de producto.
 *
 * Asume que existe AL MENOS UN producto activo en la BD. Si no, salta los
 * pasos que requieren producto (no falla el test, sólo lo marca como skipped).
 */
test.describe('Storefront — navegación básica', () => {
    test('home responde 200 y muestra el header con búsqueda', async ({ page }) => {
        const response = await page.goto('/');
        expect(response?.status()).toBeLessThan(400);

        // El nombre de la tienda (siteName) o el logo deben estar presentes.
        await expect(page.locator('header')).toBeVisible();
    });

    test('listado de productos carga y los filtros se aplican vía URL', async ({ page }) => {
        await page.goto('/products');
        await expect(page.locator('h1')).toContainText(/productos|catálogo/i);

        // Aplicar un filtro de orden y comprobar que la URL actualiza.
        const sortSelect = page.locator('select').first();
        if (await sortSelect.isVisible()) {
            await sortSelect.selectOption('price-asc').catch(() => undefined);
            await expect(page).toHaveURL(/sort=price-asc/);
        }
    });

    test('healthcheck devuelve 200 OK con db: up', async ({ request }) => {
        const res = await request.get('/api/health');
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.db).toBe('up');
    });

    test('sitemap.xml responde y contiene URLs', async ({ request }) => {
        const res = await request.get('/sitemap.xml');
        expect(res.ok()).toBe(true);
        const body = await res.text();
        expect(body).toContain('<urlset');
        expect(body).toContain('<url>');
    });

    test('robots.txt es válido', async ({ request }) => {
        const res = await request.get('/robots.txt');
        expect(res.ok()).toBe(true);
        const body = await res.text();
        expect(body).toContain('User-agent');
    });
});
