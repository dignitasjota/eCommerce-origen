import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para los tests E2E críticos.
 *
 * Filosofía: tests **smoke** que cubren los 5 flujos más caros si rompen
 * (checkout, login admin, listado pedidos, registro+login, cookie consent).
 * No son tests exhaustivos — son "está la tienda viva y vendiendo" tests.
 *
 * Ejecución:
 *   npm run test:e2e          → corre todos los tests (con dev server auto)
 *   npm run test:e2e:ui       → modo interactivo
 *   npm run test:e2e:debug    → con inspector
 *
 * En CI, Playwright reusa el dev server si ya está activo. En local fresca
 * arranca `npm run dev` automáticamente y espera al puerto 3000.
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false, // tests dependen de BD compartida (datos seed)
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // serial para evitar interferencias entre tests
    reporter: process.env.CI ? 'github' : 'list',
    timeout: 30_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],

    // Sólo arranca el dev server local cuando E2E_BASE_URL no está fijado
    // (CI puede apuntar a un staging deployado).
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: 'npm run dev',
              url: 'http://localhost:3000',
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
              stdout: 'ignore',
              stderr: 'pipe'
          }
});
