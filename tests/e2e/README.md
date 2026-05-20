# Tests E2E — flujos críticos

Smoke tests con Playwright que validan los flujos cuya rotura **bloquea ventas**:

1. **Cookie consent** — el banner aparece, persiste tras aceptar y se carga la página normalmente.
2. **Storefront → checkout COD** — visitar home, añadir al carrito, completar checkout sin Stripe.
3. **Login admin** — un admin con credenciales válidas accede al dashboard.
4. **Admin → listado de pedidos** — la página `/admin/orders` muestra el pedido recién creado.
5. **Registro + login cliente** — flujo de alta de un nuevo cliente.

## Pre-requisitos

- BD con datos seed: al menos 1 producto activo + 1 método de envío activo + 1 admin.
- En desarrollo local: `npm run dev` corriendo (Playwright lo arranca solo si no está).

## Ejecución

```bash
npm run test:e2e            # headless, todos los tests
npm run test:e2e:ui         # interactive UI
npm run test:e2e:debug      # con Playwright Inspector
```

En CI:

```bash
E2E_BASE_URL=https://staging.tudominio.com npm run test:e2e
```

(Cuando `E2E_BASE_URL` está fijado, Playwright NO arranca dev server; apunta al staging deployado).

## Datos de prueba esperados

Los tests asumen variables de entorno con credenciales del admin generadas por el seed:

```
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=<password de logs del primer arranque>
```

Para tests de checkout COD basta con que exista al menos 1 producto activo
(el seed-bootstrap no crea productos demo, así que en local hay que añadir
uno manualmente desde `/admin/products` antes de correr los tests).
