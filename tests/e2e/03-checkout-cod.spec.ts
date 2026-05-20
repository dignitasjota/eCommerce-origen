import { test, expect } from '@playwright/test';

/**
 * Smoke test del flujo más crítico: añadir un producto al carrito y completar
 * checkout con COD (sin Stripe — Stripe requiere claves reales y entorno test).
 *
 * Si NO hay productos en la BD, este test se marca como skipped: sin catálogo
 * no se puede comprobar checkout.
 */
test.describe('Storefront — checkout COD', () => {
    test('añadir producto al carrito y completar checkout COD', async ({ page }) => {
        await page.goto('/products');

        // Localizar el primer producto del listado.
        const firstProduct = page.locator('a.product-card').first();
        const hasProduct = await firstProduct.isVisible().catch(() => false);
        test.skip(!hasProduct, 'No hay productos en la BD — skipped');

        // Capturar slug del primer producto para navegar a su ficha.
        const productHref = await firstProduct.getAttribute('href');
        expect(productHref).toBeTruthy();

        await page.goto(productHref!);

        // Cerrar el banner de cookies si aparece (interfiere con clicks).
        const cookieBtn = page.getByRole('button', { name: /sólo necesarias/i });
        if (await cookieBtn.isVisible().catch(() => false)) {
            await cookieBtn.click();
        }

        // Botón "Añadir al carrito" en la ficha — el texto puede variar según locale.
        const addBtn = page.locator('button').filter({ hasText: /añadir al carrito|add to cart/i }).first();
        await addBtn.click();

        // Verificar feedback (badge del cart actualizado o drawer abierto).
        await page.waitForTimeout(500); // CartContext propaga state

        // Ir directamente a /checkout.
        await page.goto('/checkout');

        // Sin método de envío configurado el test no puede continuar.
        const noMethods = page.getByText(/no hay métodos de envío|sin métodos/i);
        const hasNoMethodsMessage = await noMethods.isVisible().catch(() => false);
        test.skip(hasNoMethodsMessage, 'No hay métodos de envío configurados — skipped');

        // Paso 1: Email
        await page.fill('input#email', 'e2e-test@example.com');
        await page.getByRole('button', { name: /continuar.*envío/i }).click();

        // Paso 2: Dirección
        await page.fill('input[name="firstName"]', 'Test');
        await page.fill('input[name="lastName"]', 'E2E');
        await page.fill('input[name="address1"]', 'Calle Test 1');
        await page.fill('input[name="city"]', 'Madrid');
        await page.fill('input[name="postalCode"]', '28001');
        await page.fill('input[name="state"]', 'Madrid');
        await page.fill('input[name="phone"]', '600000000');
        await page.getByRole('button', { name: /continuar al pago/i }).click();

        // Paso 3: Pago — seleccionar COD para evitar Stripe.
        const codRadio = page.locator('input[value="COD"]');
        await codRadio.check();

        // Submit final.
        const payBtn = page.getByRole('button', { name: /pagar/i });
        await payBtn.click();

        // Verificar redirección a /checkout/success/...
        await page.waitForURL(/\/checkout\/success\//, { timeout: 15_000 });
        await expect(page.locator('h1, h2')).toContainText(/gracias|exitoso|recibido|confirmado/i);
    });
});
