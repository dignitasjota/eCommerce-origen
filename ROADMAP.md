# Roadmap eCommerce

> Plan derivado de la auditoría del **2026-04-30** y ejecutado en los Sprints 1–5 + tareas continuas (cierre el **2026-05-02**). Auditoría de seguridad adicional en profundidad cerrada el **2026-09-10** (ver bloque dedicado más abajo), seguida de un plan de migración Next.js/Prisma en rama aparte (ver bloque dedicado) y del arranque del backlog premium (ver bloque dedicado).
>
> Detalle de cada implementación en [`CLAUDE.md`](./CLAUDE.md). Este documento es el resumen accionable: qué está hecho, qué queda pendiente y qué hay en backlog.

---

## Estado global (2026-09-10)

| Bloque | Estado | Notas |
|---|---|---|
| Sprint 1 — Seguridad bloqueante | ✅ Completado | 8/8 ítems |
| Sprint 2 — Pagos reales | ✅ Completado | 4/4 ítems · pendiente migración DB + config Stripe |
| Sprint 3 — Performance & SEO | ✅ Completado | 4/4 ítems · falta medir LCP en producción |
| Sprint 4 — Conversión | ✅ Completado | 4/4 ítems · pendiente migración DB |
| Sprint 5 — Backoffice | ✅ Completado | 7/7 ítems · WYSIWYG añadido en bloque DX & Editorial |
| Continuo — Deuda técnica | ✅ 8/8 | Todos completados |
| Auditoría de seguridad (2026-09-10) | ✅ Completado | Todos los hallazgos corregidos y validados con e2e real |
| Plan de migración Next.js/Prisma (2026-09-10) | 🔵 Planificado (Fase 0 aplicada) | Rama `chore/nextjs-prisma-major-upgrade-plan`, sin fusionar — ver bloque dedicado |
| Backlog premium | 🟡 10/14 — resto fuera de alcance incremental | A/B testing completado 2026-09-10 (junto a los 9 anteriores); los 4 restantes son cambios de arquitectura/modelo de negocio o requieren integración externa de pago — ver bloque dedicado |

**Verificación final:** `npx tsc --noEmit` → exit 0 (sin errores) · `npm run build` sin errores · suite Playwright e2e completa: 19 passed / 1 skipped / 0 failed (contra MariaDB real).

---

## Sprint 1 — Seguridad bloqueante 🔴

- [x] **#1** `requireAdmin()` + `AuthorizationError` en `src/lib/auth.ts`. Aplicado a 31 server actions del admin con roles granulares. Un admin no puede borrarse a sí mismo.
- [x] **#2** Checkout reescrito: precios, `name`, productos activos y variantes se releen desde DB. Validación de email + 6 campos obligatorios de dirección. Límite de 100 ítems/carrito.
- [x] **#3** Stock atómico con `updateMany({ where: { id, stock: { gte: q } } })` dentro de `$transaction`. `count !== 1` ⇒ rollback ⇒ HTTP 409.
- [x] **#5** `src/lib/sanitize.ts` con `isomorphic-dompurify`. Aplicado al guardar (productos, blog, pages, legal) y al renderizar (defensa en profundidad).
- [x] **#6** `src/lib/coupons.ts` con `resolveCoupon` (validación pura: `is_active`/`starts_at`/`expires_at`/`max_uses`/`min_purchase`) y `consumeCoupon` (incremento atómico). UI `<NewsletterForm>` errónea — corregida en CheckoutClient con dry-run vía `POST /api/storefront/coupon`.
- [x] **#7** Raíz del repo limpia. `.gitignore` ampliado con patrones `/test_*`, `/check-*`, `/create-*`, `/fix_*`, `/query_*`, `/seed_*`, `/curl_output.*`, `/*.log`, `/dev_output.*`, `/build_output.*`. Útiles a `scripts/dev/`.
- [x] **#18** Rate limiter en memoria por (bucket, IP) con TTL y purgado perezoso. Aplicado a register (5/10min), forgot-password (3/15min), reset-password (5/15min), checkout (10/min), search (60/min), coupon (20/min), newsletter (5/10min).
- [x] **#21** `order_number = ORD-YYYYMM-XXXXXXXX` con sufijo `crypto.randomBytes(4)` (no enumerable, ~4·10⁹ por mes).

---

## Sprint 2 — Pagos reales 🔴

- [x] **#4** Cliente Stripe singleton (`src/lib/stripe.ts`). En `/api/storefront/checkout`, si `paymentMethod ∈ {STRIPE, CARD}`, crea Checkout Session con `metadata.order_id`, persiste `payment_intent_id`/`payment_id`, devuelve `{ checkoutUrl }`. La orden nace en `PENDING_PAYMENT`.
- [x] **#4.b** `POST /api/webhooks/stripe`: verificación de firma con `stripe-signature`, idempotencia vía `WebhookEvent` UNIQUE (provider, event_id). Handlers: `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`, `charge.refunded`, `payment_intent.canceled`.
- [x] **#17** `src/lib/emails/notify.ts` con `sendOrderStatusEmail()`. Plantilla `order-status-update.ts` rediseñada con paleta por estado y `tracking_number` cuando SHIPPED. `updateOrderFullStatus` y el webhook lo invocan.
- [x] **#27.a** Schema: enum `OrderStatus.PENDING_PAYMENT`, columnas `Order.payment_intent_id` UNIQUE, `Order.invoice_number` UNIQUE, `Order.invoice_url`, `Address.tax_id`, modelo `WebhookEvent`.

**Pendiente operativo:**
- Aplicar migración Prisma (`npx prisma db push`).
- Configurar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en Plesk.
- Crear endpoint Stripe → `https://tudominio.com/api/webhooks/stripe`.
- (Opcional) Cron de limpieza de órdenes `PENDING_PAYMENT` vencidas (>30 min).

---

## Sprint 3 — Performance & SEO 🟠

- [x] **#9** Cero `<img>` en storefront. Migrado a `next/image` con `fill`+`sizes` responsivos en cards y gallery, tamaño fijo en thumbnails/logos, `priority` en LCP (gallery principal, blog hero, header logo).
- [x] **#10** `getProduct(slug, locale)` envuelto en `cache()` de React → `generateMetadata` y la página comparten 1 round-trip a DB. Wishlist/order/review consultas paralelizadas con `Promise.all` (3 RT → 1 RT). `select` mínimo en las dos últimas.
- [x] **#19** SEO completo:
  - `metadataBase` + `alternates.languages` (hreflang `es`/`en`/`x-default`) en root layout y por página.
  - `BreadcrumbList` JSON-LD en producto.
  - `Article` JSON-LD en blog (`datePublished`, `dateModified`, `author`, `image`, `mainEntityOfPage`).
  - `canonical` con paths sin prefijo en `es`.
  - `noindex` en `/products?q=` para no diluir señal.
  - `og:images` dinámico en categorías.
  - Sitemap con `priority` y `changeFrequency` calculados por recencia (<7d, <30d, <180d, resto) y boost +0.1 para `is_featured`.
- [x] **#25** `CartPage` sin `return null` ni flag `mounted`. SSR genera HTML con carrito vacío y el cliente hidrata localStorage en `useEffect` del provider (sin mismatch).

**Pendiente:** medir LCP/Lighthouse en producción tras desplegar.

---

## Sprint 4 — Conversión 🟠

- [x] **#11** `<ProductFilters>` cliente con sort, rango precio y selector categoría — preserva `q`/`page` y reinicia `page` al filtrar. Server: `Prisma.ProductWhereInput` + `orderBy` por `sort`. Paginación arreglada para conservar todos los filtros. Endpoint `GET /api/storefront/search` (rate-limit 60/min) y `<SearchAutocomplete>` con debounce 250ms, navegación por teclado, `aria-*` completo.
- [x] **#12** Tabla `Subscriber` (email UNIQUE, confirm_token UNIQUE 256-bit). `POST /api/storefront/newsletter` con doble opt-in y respuesta genérica anti-enumeración. `GET /confirm?token=` cierra opt-in y redirige al home con flag (`confirmed|already|invalid`). `<NewsletterForm>` con estados de carga/éxito/error.
- [x] **#22** `POST /api/storefront/cart/merge`: valida productos activos, suma cantidades por `(product_id, variant_id)`, recalcula `name/price/image` desde DB, reescribe `cart_items` en transacción. `CartProvider` recibe `userId` desde server layout y dispara la fusión una vez por usuario (flag `eshop_cart_merged_for`).
- [x] **#30 selectivo** `src/lib/recently-viewed.ts` (cookie `eshop_recent`, 12 slugs, 30d). `pushRecentSlug` desde `product/[slug]/page.tsx`. `<RecentlyViewed>` server component en home y producto.

**Pendiente operativo:** migración para `subscribers` (incluida en `prisma db push` global).

---

## Sprint 5 — Backoffice 🟠

- [x] **#13** Dashboard reescrito: 4 KPIs últimos 30 días (ingresos PAID, pedidos PAID, AOV, usuarios), gráfico de barras diarias con SVG inline (`<RevenueChart>` — sin recharts, ~100KB ahorrados), tabla "pedidos por estado" con `groupBy`, top 5 productos vendidos vía `orderItem.groupBy`, recent orders. Todo en `Promise.all` (8 queries).
- [x] **#14** Cero `window.location.reload()`. 19 ocurrencias eliminadas en 9 managers. Patrón nuevo: `closeModal()` + `router.refresh()`.
- [x] **#15** Paginación server-side (offset+25, ventana adaptativa con elipsis) en `/admin/products`, `/admin/orders`, `/admin/users`, `/admin/blog`. Componente reutilizable `<AdminPagination>`.
- [x] **Filtros + Export CSV en pedidos**: filtros server-side por búsqueda libre, estado, payment_status y rango de fechas. Form `method="GET"`. Endpoint `GET /api/admin/orders/export` (admin-only, BOM UTF-8, hasta 10k filas).
- [x] **#16** Editor de variantes plano: server actions `createVariant`/`updateVariant`/`deleteVariant` con guard contra borrar la última y manejo de P2002/P2003. Variantes con precio vacío heredan del producto base. `<VariantsManager>` con CRUD inline.
- [x] **#23** Tipos `Prisma.GetPayload<...>` con `satisfies` en `src/types/admin.ts`: `AdminProduct`, `AdminCategory`, `AdminUser`, `AdminOrderListItem`, `AdminBlogPost`. Aplicados en managers principales.
- [x] **WYSIWYG (Tiptap)** — implementado en el bloque "DX & Editorial" (ver más abajo). ✅ 2026-05-02

---

## Continuo — Deuda técnica 🟡

- [x] **#8** `src/proxy.ts` → `src/middleware.ts` (Next.js solo carga ese nombre exacto).
- [x] **#20** Schemas Zod en `src/lib/schemas/` (`auth`, `checkout`, `newsletter`). Aplicados en register, newsletter, coupon. Patrón `safeParse` documentado.
- [x] **#24** `parseShortcodes()` en `src/lib/shortcodes.ts` produce AST plano (`html | shortcode`). Reemplaza split-regex+innerHTML.
- [x] **#27.b** Schema ampliado: `Product.weight`/`dimensions`/`barcode`, `Review.images`/`is_verified_purchase`, `User.is_active`/`last_login_at`, `Order.fulfillment_status` (enum `FulfillmentStatus`).
- [x] **#27.c** Tablas: `AuditLog`, `Subscriber` (Sprint 4), `StockMovement` (con `StockMovementReason`).
- [x] **#28** Accesibilidad WCAG AA básica: skip-to-content, `:focus-visible` global, los 43 SVGs decorativos del storefront marcados `aria-hidden="true" focusable="false"`, `<main id="main-content" tabIndex={-1}>`.
- [x] **#26** Cursor pagination — `src/lib/pagination.ts` con cursor opaco (base64url JSON `{id}`) + componente `<CursorPagination>`. Aplicado a `/admin/orders`, `/blog` público y nueva página `/admin/audit-logs` (sólo ADMIN, con filtros + lookup de usuarios). Listados pequeños mantienen offset+25. ✅ 2026-05-02
- [x] **#29** Decisión DaisyUI vs CSS propio — purgado DaisyUI. Auditoría reveló que sólo se usaban 2 primitivas (`stats` en dashboard, `tabs` en settings); el resto eran clases custom (`admin-*`, `btn-*`, `card-*`). Ambas reescritas en `globals.css` (~80 líneas). ~70KB de bundle ahorrados. ✅ 2026-05-02

---

## Despliegue (plantilla dockerizada)

> **Cambio de paradigma (2026-05-02):** la plantilla ya no se despliega manualmente en Plesk. Es una imagen Docker que se levanta con `docker compose up -d` en cualquier VPS con Portainer. Cada cliente = una instancia. La BD arranca vacía y se autoconfigura.

Para desplegar una nueva tienda:

1. **Configurar `.env`** (sólo 4 variables imprescindibles):
   - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`.
   - Opcional: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (si vacío, password autogenerada en logs).
2. **`docker compose up -d`** o desplegar como stack en Portainer.
3. **Login admin** con las credenciales mostradas en logs → cambiar password.
4. **Configurar desde el panel** (`/admin/settings`):
   - Branding (`site_name`, `site_logo`, `site_favicon`).
   - SMTP (`smtp_host`/`smtp_port`/`smtp_user`/`smtp_pass`/`smtp_from`).
   - Stripe (`stripe_secret_key`, `stripe_webhook_secret`).
   - Métodos de envío, métodos de pago, categorías, productos, páginas legales.
5. **Configurar webhook Stripe** apuntando a `https://tu-dominio/api/webhooks/stripe` (ver `docs/deploy-docker.md` §Stripe).

Detalles paso a paso en [`docs/deploy-docker.md`](./docs/deploy-docker.md).

**Sin migración manual** — el entrypoint del contenedor aplica `prisma db push` en cada arranque (idempotente). Funciona tanto en BD vacía (crea todo) como en BD existente (aplica diff).

---

## Pendientes de código (futuro)

- [x] **Cron de `PENDING_PAYMENT` vencidos** (>30 min) — `POST /api/admin/cron/cleanup-pending-orders` con header `x-cron-secret`. ✅ 2026-05-02
- [x] **Cron de carrito abandonado** — `POST /api/admin/cron/abandoned-carts`, ventana 24h-26h sin columna nueva. ✅ 2026-05-02
- [x] **Cableado de `AuditLog`** — `src/lib/audit.ts` + invocaciones en products/orders/users/settings/coupons/variants. ✅ 2026-05-02
- [x] **Cableado de `StockMovement`** — `src/lib/stock.ts`. PURCHASE en checkout, REFUND en webhook, ADJUSTMENT/RESTOCK en editor de variantes, RESERVATION_RELEASE en cron PENDING_PAYMENT. ✅ 2026-05-02
- [x] **Generación de factura PDF** — `src/lib/invoice.ts` + `src/lib/invoice-pdf.ts` (pdfkit) + endpoint `GET /api/admin/orders/[id]/invoice.pdf`. `invoice_number` lazy en webhook. Datos vendedor en SiteSettings. ✅ 2026-05-02
- [x] **Form Stripe en admin** — pestaña "Pagos (Stripe)" en `/admin/settings` con `stripe_secret_key`/`stripe_webhook_secret`/`stripe_publishable_key` + datos del vendedor para facturas. ✅ 2026-05-02

**Pendiente operativo:**
- Definir variable `CRON_SECRET` en el deploy (env del compose).
- Configurar job externo (cron-job.org o side-car en docker-compose) que llame a los endpoints `/api/admin/cron/*` con cabecera `x-cron-secret: $CRON_SECRET`. Frecuencias recomendadas:
  - `cleanup-pending-orders`: cada 5 min.
  - `abandoned-carts`: cada hora (o una vez al día).

---

## Compliance fiscal/legal y devoluciones (2026-05-02)

- [x] **#19 Facturación correlativa estricta** — tabla `InvoiceCounter` con UNIQUE `(series, year)`. `claimInvoiceNumber(tx, orderId)` con UPSERT atómico. Formato `<SERIE>-YYYY-NNNNNNN`. Webhook llama dentro de la misma transacción que confirma `PAID`. Serie configurable en `/admin/settings → Pagos`. ✅ 2026-05-02
- [x] **#20 Cookie consent banner (RGPD)** — `<CookieConsent>` cliente con granularidad `necessary/analytics/marketing`, persistencia 12 meses, versión para invalidar consents previos. `<AnalyticsScripts>` carga GA4/Meta Pixel reactivamente al consent (escucha `eshop:consent-changed`). Pestaña "Analítica & Cookies" en admin con `analytics_ga4_id`, `analytics_meta_pixel_id`, `cookies_policy_url`. ✅ 2026-05-02
- [x] **#21 Flujo de devoluciones (RMA)** — schema `Return` + `ReturnItem` con enums `ReturnStatus` (REQUESTED/APPROVED/REJECTED/RECEIVED/REFUNDED/CANCELLED) y `ReturnItemCondition`. Endpoint cliente `POST /api/storefront/returns` con validación de elegibilidad (DELIVERED + PAID + ventana 14 días). Server actions admin `approveReturn/rejectReturn/markReturnReceived/refundReturn` con integración Stripe `refunds.create`. UI cliente `/account/orders/[id]/return` con form selectivo. UI admin `/admin/returns` (listado + detalle con panel de acciones contextual). Email transaccional en cada transición. `StockMovement(REFUND)` al recibir mercancía. `AuditLog` en cada paso. ✅ 2026-05-02

---

## Pre-producción y robustez (2026-05-02)

- [x] **#18 Restock condicional** — al marcar RECEIVED, sólo se incrementa `ProductVariant.stock` si `condition ∈ {UNOPENED, OPENED}`. Para `DAMAGED`/`USED` no se toca stock; el descarte queda trazado en `AuditLog` con métricas `restocked`/`discarded`. ✅ 2026-05-02
- [x] **#35 Backup automatizado** — side-car opcional `backup` en `docker-compose.yml` con `mariadb-dump`+gzip, cron configurable (`BACKUP_CRON` default 03:00 UTC), retención `BACKUP_KEEP_DAYS` (default 30) y backup inmediato al primer arranque para verificar configuración. Volumen `db-backups` separado. Activación: `docker compose --profile backup up -d`. ✅ 2026-05-02
- [x] **#38 Tests Playwright** — 6 ficheros spec con flujos críticos: cookie consent, navegación storefront + healthcheck/sitemap/robots, checkout COD end-to-end, login admin (con guards), listado de pedidos + export CSV, registro cliente + rate-limit. Scripts `npm run test:e2e[:ui|:debug]`. Config con `webServer` que arranca `npm run dev` automáticamente o respeta `E2E_BASE_URL` para staging. ✅ 2026-05-02

---

## DX & Editorial (2026-05-02)

- [x] **#36 CI/CD con GitHub Actions** — `.github/workflows/ci.yml` con 4 jobs: `quality` (typecheck + lint, lint en `continue-on-error` hasta limpiar warnings legacy), `e2e` (services MariaDB 10.11 + Playwright + bootstrap automático con admin determinista `ci-admin@example.com` + build + tests), `docker-build` (Buildx con cache `type=gha` + smoke test `node --version`), `docker-publish` (push a `ghcr.io/<repo>:latest` y `:vX.Y.Z` sólo en tags semver). Concurrency cancela runs antiguos por rama. ✅ 2026-05-02
- [x] **#18 Drag & drop imágenes** — `src/components/backoffice/ImageUploader.tsx` cliente reutilizable: drop zone con click/keyboard/paste, preview con `URL.createObjectURL` (revocado al desmontar), reorder con HTML5 drag native, marca de delete reversible, sync con input file oculto vía `DataTransfer` para que `new FormData(form)` los recoja, serialización del orden y deletes en input hidden `images_order` (JSON). Aplicado en ProductsManager (galería unificada — la primera imagen es la principal), CategoriesManager (imagen única) y BlogManager (cover 16:9 — campo nuevo). Server actions extendidas para procesar `images_order`: reorder atómico, borrado físico de `/uploads/` (best-effort), append de archivos nuevos al final con `sort_order` consecutivo. ✅ 2026-05-02
- [x] **#1 Editor WYSIWYG (Tiptap)** — `src/components/backoffice/RichTextEditor.tsx` cliente con StarterKit (headings h2/h3, listas, bold/italic/strike/code, blockquote, hr, undo/redo) + Link (target=_blank rel=noopener) + Image (URL externa, no base64) + Placeholder + TextAlign. Output HTML compatible con `sanitizeHtml` y los shortcodes `{{category_id:slug}}` (Tiptap los preserva como texto plano). `immediatelyRender: false` para evitar mismatch SSR. Toolbar con grupos (formato/listas/alineación/inserción/historial) y `aria-pressed` en botones activos. Aplicado en ProductsManager (descripción), BlogManager (content), PagesManager (content), LegalManager (content). ✅ 2026-05-02

---

## Observabilidad y robustez de operaciones (2026-05-02)

- [x] **Monitorización externa** — `/api/health` ampliado con `uptimeSeconds`/`startedAt` y nuevo `/api/health/deep` que valida config (BD, admin, SMTP, Stripe, NEXTAUTH_SECRET, CRON_SECRET) devolviendo `status: ok|warning|critical`. Doc `docs/monitoring.md` con setup UptimeRobot/BetterStack/cron-job.org. ✅ 2026-05-02
- [x] **Cron de retención** — `/api/admin/cron/retention` purga diariamente `WebhookEvent` >90d, `AuditLog` >365d, `StockMovement` >730d (ventanas configurables vía SiteSettings: `retention_webhook_event_days`, `retention_audit_log_days`, `retention_stock_movement_days`). Best-effort por tabla. `auditLogServer` registra el propio job. ✅ 2026-05-02
- [x] **Test E2E del webhook Stripe** — `tests/e2e/07-stripe-webhook.spec.ts` + `tests/e2e/helpers/stripe-signature.ts`. Helper de firma con HMAC SHA256 (sin SDK), valida 4 escenarios: sin cabecera (400), firma inválida (400), event nuevo procesa, event repetido devuelve `duplicated:true`. CI inyecta `STRIPE_WEBHOOK_SECRET=whsec_test_e2e_only_not_a_real_secret` y `STRIPE_SECRET_KEY=sk_test_…`. ✅ 2026-05-02
- [x] **Sentry opcional para errores no controlados** — `src/lib/sentry.ts` con guard `isSentryEnabled()`. `src/instrumentation.ts` (server) y `src/instrumentation-client.ts` (browser) inicializan el SDK sólo con `SENTRY_DSN`. `captureError` cableado en webhook Stripe y catch genérico de checkout (excluye 409 de stock/cupón — son negocio normal, no ruido). `src/app/global-error.tsx` reporta crashes del cliente con `useEffect`. Filtros `beforeSend`: descarta `NEXT_REDIRECT` y `Unique constraint` (manejados explícitamente). Variables del compose: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ENV` / `SENTRY_TRACES_SAMPLE_RATE`. Doc `docs/observability.md` con setup, tuning, replays y releases. ✅ 2026-05-02

---

## Auditoría de seguridad en profundidad (2026-09-10) 🔴

Auditoría completa del código (4 agentes en paralelo sobre distintas porciones del sistema) seguida de corrección de **todos** los hallazgos y validación real contra Node 22 + MariaDB en Docker + build de producción + suite Playwright e2e completa — no sólo lectura de código. Detalle extendido en [`CLAUDE.md §9.9`](./CLAUDE.md#99-auditoría-de-seguridad-en-profundidad--validación-real-2026-09-10).

- [x] **Middleware sin protección real en `/admin/*`** — el callback `authorized` de NextAuth era código muerto; cualquiera sin login veía `/admin/settings` (claves Stripe/SMTP) y `/admin/users` (PII). Ahora `src/middleware.ts` decodifica el JWT con `getToken()` y bloquea/redirige. ✅ 2026-09-10
- [x] **Subida de imágenes sin validar en servidor** — extensión/tipo confiados del cliente, riesgo de XSS almacenado vía `.html`/`.svg`. Nuevo `src/lib/uploads.ts`: whitelist MIME + magic bytes + nombre generado en servidor. `bodySizeLimit` de Server Actions corregido (1MB→32MB). ✅ 2026-09-10
- [x] **Arranque de Docker roto** — `docker-entrypoint.sh` y el job `e2e` de CI usaban un flag de Prisma (`--skip-generate`) que no existe en la versión instalada; con `set -e`, tumbaba el arranque del contenedor **en todo despliegue**. ✅ 2026-09-10
- [x] **Webhook de Stripe: fugas de stock/cupón** — pagos fallidos/expirados/cancelados no revertían stock ni cupón y quedaban fuera del alcance del cron de limpieza. Reembolsos parciales se trataban como totales. Reembolsos vía RMA duplicaban la restitución de stock. Reescrito completo. ✅ 2026-09-10
- [x] **RMA: doble reembolso por condición de carrera** — `refundReturn` llamaba a Stripe antes de reservar el estado. Ahora reserva primero (guard atómico) + `idempotencyKey`. ✅ 2026-09-10
- [x] **RMA: ventana de devolución sobre `updated_at`** — se reiniciaba con cualquier edición de la orden. Nuevo campo `Order.delivered_at`. ✅ 2026-09-10
- [x] **`sendEmail()` fingía éxito sin SMTP configurado** — ahora falla honestamente y reporta a Sentry si está activo. ✅ 2026-09-10
- [x] **Paginación cursor rota** — asumía UUIDs ordenables; reescrita como keyset real sobre `(created_at, id)`. ✅ 2026-09-10
- [x] **Checkout sin usar el schema Zod centralizado** — validación manual duplicada reemplazada por `checkoutSchema.safeParse()`. ✅ 2026-09-10
- [x] **Rate-limit faltante en `reviews`/`wishlist`**, **timing-safe falso en `reset-password`**, **errores P2003 crudos al borrar productos/cupones con pedidos asociados**. ✅ 2026-09-10
- [x] **`localePrefix: 'always'` inconsistente con sitemap/hreflang/rewrite** — corregido a `'as-needed'`; limpiados ~30 enlaces admin con `/es/` hardcodeado que habrían sufrido un redirect de más. ✅ 2026-09-10
- [x] **Login sin redirección por rol** y **registro sin atributos `name`** en los inputs (bugs descubiertos probando, no parte de la auditoría original). ✅ 2026-09-10

---

## Plan de migración Next.js/Prisma (2026-09-10) 🔵

A raíz de los hallazgos de `npm audit` en la auditoría de seguridad de esta misma fecha, se investigó (fuentes oficiales: blog de Next.js, documentación y GitHub de Prisma/Auth.js) si hacía falta una migración de versión mayor y se documentó el resultado en **rama aparte**, sin fusionar a `main`: [`chore/nextjs-prisma-major-upgrade-plan`](https://github.com/dignitasjota/eCommerce-origen/tree/chore/nextjs-prisma-major-upgrade-plan). Plan completo en [`docs/migration-plan-nextjs-prisma.md`](https://github.com/dignitasjota/eCommerce-origen/blob/chore/nextjs-prisma-major-upgrade-plan/docs/migration-plan-nextjs-prisma.md) — **ese archivo vive sólo en esa rama, no en `main`** (por eso el enlace apunta directo a GitHub en vez de una ruta relativa del repo).

**Conclusión de la investigación:** no había ninguna migración de versión mayor urgente. Next.js ya estaba en la última estable (16.3.4 — no existe v17 todavía) y Prisma 8 sigue en release candidate (las vulnerabilidades de `npm audit` vienen del tooling de desarrollo de Prisma — `prisma studio`/CLI —, no del cliente/motor en runtime, y son un problema conocido sin resolver en toda la línea 7.x: [prisma/prisma#29605](https://github.com/prisma/prisma/issues/29605)).

- [x] **Fase 0 — Housekeeping de bajo riesgo** (ejecutada en la rama): `@prisma/client` estaba desalineado (7.4.1) respecto a la CLI de Prisma (7.10.0, ya actualizada en la auditoría de seguridad) — realineado a 7.10.0, dentro del mismo rango semver ya aprobado, riesgo cero. Validado con `tsc`, `build` y la suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [ ] **Fase 1 — Prisma 8** (documentada, no ejecutada): puente con `@prisma/prisma7`; impacto real identificado en `.take()`/`.skip()` → `.limit()`/`.offset()` (usado extensivamente en `src/lib/pagination.ts` y todos los listados admin) y reorganización de subcomandos de la CLI (afecta a `docker-entrypoint.sh` y `.github/workflows/ci.yml`). **Disparador:** Prisma 8.0.0 marcado estable (no RC) + confirmación de que `@auth/prisma-adapter`/`@prisma/adapter-mariadb` tienen release estable compatible.
- [ ] **Fase 2 — `sharp` 0.34→0.35** (documentada, no ejecutada): usado internamente por `next/image`, parchea CVEs de `libvips`/`libheif`. **Disparador:** se toca `next/image`/`ImageUploader` por otro motivo, o revisión trimestral de rutina.
- [ ] **Fase 3 — `nodemailer` 7→10 (tres majors) y `@tiptap/*` 2→3** (documentada, no ejecutada): requieren pruebas manuales específicas no cubiertas por `tsc`/`build`/e2e (SMTP real, cada botón del editor WYSIWYG). **Disparador:** CVE real sobre funcionalidad efectivamente usada, o revisión trimestral de rutina.
- [ ] **Next.js 17**: no existe todavía — sólo monitorizar [nextjs.org/blog](https://nextjs.org/blog).

---

## Backlog premium 🟢 (#30)

A planificar según prioridad de negocio. Los items con (✓ schema) ya tienen el campo persistente preparado.

- [x] **Reseñas con foto + verificación** — `POST /api/storefront/reviews` acepta ahora multipart con hasta 5 fotos (reutiliza `src/lib/uploads.ts`: whitelist MIME + magic bytes + nombre en servidor). `is_verified_purchase` se fija a `true` en la creación (antes se comprobaba la compra PAID pero el campo nunca se escribía). `ReviewForm.tsx` reutiliza el `<ImageUploader>` del admin sin cambios. La ficha de producto muestra las fotos y condiciona el badge "Compra verificada" al campo real. **Hallazgo bloqueante encontrado al implementar:** no existía ninguna forma de aprobar una reseña — `is_approved` nacía en `false` y ningún código lo ponía nunca en `true`, así que el sistema de reseñas llevaba desde el Sprint 1 sin mostrar nada en público. Se añadió `/admin/reviews` (listado con pestañas pendientes/aprobadas/todas, aprobar/despublicar/eliminar con borrado físico best-effort de las fotos), siguiendo el patrón estándar de manager admin. Validado de extremo a extremo con Playwright (compra PAID sembrada → reseña con foto → oculta hasta aprobar → aprobación en admin → visible públicamente) + tsc/eslint/build limpios + suite e2e estándar (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Stock countdown / urgencia** — aviso "¡Solo quedan X unidades!" usando `ProductVariant.stock`, umbral `LOW_STOCK_THRESHOLD=5` en `src/lib/inventory.ts`. En la ficha de producto (`AddToCartForm.tsx`) usa el stock exacto de la variante seleccionada; en los listados (`/products`, `/category/[slug]`) un badge "¡Últimas N!" con la suma de stock de variantes activas (sin contexto de variante todavía a ese nivel). Nunca se muestra si `unlimited_stock=true` o el stock supera el umbral. Validado con un producto de stock bajo sembrado por fixture (3 unidades) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Wishlist compartible** — `User.wishlist_share_token` (256 bits hex, UNIQUE, nullable, mismo criterio que `Subscriber.confirm_token`). Desde `/account/wishlist`, `generateWishlistShareLink()`/`revokeWishlistShareLink()` generan/desactivan el enlace (idempotente: no rota un token ya existente). Nueva ruta pública `/wishlist/[token]` (sin autenticación, `robots: noindex`) que sólo expone el nombre de pila del dueño y los productos guardados, con "Añadir al carrito" — nunca email, dirección ni pedidos. Validado con Playwright: generar → visible sin sesión → desactivar → el enlace antiguo devuelve 404. tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Comparador de productos** — selector multi-producto (hasta 4) vía `CompareContext` en localStorage (`eshop_compare`, sin backend — herramienta de sesión igual que el carrito anónimo), `<CompareButton>` en tarjetas de `/products`, `/category/[slug]` y la ficha de producto, `<CompareBar>` flotante y tabla de specs en `/compare` (precio, valoración media, disponibilidad, SKU, peso, dimensiones, categoría) servida por `GET /api/storefront/compare` (rate-limit 30/min, ids validados, capados a 4). **Bug real encontrado y corregido en la validación:** `MAX_COMPARE_ITEMS` se importaba desde un módulo `'use client'` dentro del route handler del servidor — Next.js convierte esos exports en referencias de cliente al importarlos desde servidor, así que la constante dejaba de ser el número 4 y `.slice(0, MAX_COMPARE_ITEMS)` vaciaba el array en silencio (200 OK con `products: []`, sin error visible). Extraída a `src/lib/compare.ts` (sin `'use client'`). Validado con Playwright (seleccionar 2 productos → tabla con specs correctas → quitar uno) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Live chat / WhatsApp Business** — botón flotante (`WhatsAppButton.tsx`, sin JS/SDK, enlaza a `wa.me/<número>?text=<mensaje>` en pestaña nueva — WhatsApp Business no ofrece widget embebible oficial gratuito). Configurable desde una nueva pestaña "WhatsApp" en `/admin/settings` (número + mensaje inicial, mismo patrón que "Analítica & Cookies"); no se muestra si el número está vacío. Validado con Playwright (configurar → botón visible con href wa.me exacto → vaciar desactiva) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Permisos granulares (RBAC fino)** + **log de auditoría completo** — `User.permissions` (JSON nullable, `null` = bucket por defecto, backward-compatible) con 11 permisos delegables por usuario ORDER_MANAGER (`src/lib/permissions.ts`); `settings`/`users`/`payments` quedan deliberadamente fuera del set delegable (nunca delegables — delegar `users` permitiría auto-promoción a ADMIN). `requireAdmin(roles, permission?)` consulta el permiso en BD (no en el JWT, efecto inmediato) y el nuevo `hasPermission()` gatea la visibilidad de las 19 páginas admin (antes cualquier ORDER_MANAGER podía **ver** `/admin/settings`/`/admin/users`/etc. aunque las acciones ya rechazaran). UI de checklist en `/admin/users`. AuditLog cerrado en las 5 áreas que no registraban nada (categories/pages/blog/shipping/payments). **Bug real corregido en la validación:** `UsersManager.tsx` no resincronizaba su state tras `router.refresh()` — crear/editar un usuario no se reflejaba en la tabla sin recargar a mano. Validado con Playwright (usuario restringido a 1 permiso → accede sólo ahí → 404 en el resto → 404 también en áreas nunca delegables → auditLog visible) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **PWA** — `src/app/manifest.ts` (`force-dynamic`) lee name/icons desde `SiteSettings` (`site_name`/`site_logo`/`site_favicon`) para que cada cliente de la plantilla vea su propia marca al instalar la PWA. `public/sw.js`: cache-first en `/_next/static` y `/uploads`, network-first con fallback a caché en navegación — excluye `/admin`, `/api` y `/auth` a propósito (nunca servir stock/pedidos/sesión desde caché). `ServiceWorkerRegister.tsx` sólo se registra en producción y sólo en la storefront. `appleWebApp`/`apple-touch-icon` para "Añadir a pantalla de inicio" en iOS. **Bug real encontrado y corregido en la validación:** el rewrite de fallback de `next.config.ts` (para Plesk/Passenger) reescribía todo a `/es/:path` excepto una lista de excepciones escrita antes de que existieran `manifest.webmanifest`/`sw.js` — ambos caían en el catch-all y devolvían 404. Añadidos a la exclusión. Validado: build confirma la ruta dinámica, contenido correcto vía curl, refleja un cambio de `site_name` sin rebuild, `<link rel="manifest">` presente en el HTML + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Programa de fidelización** — `User.loyalty_points` + `LoyaltyTransaction` (ledger EARN/REDEEM/REVERSAL, mismo patrón que `StockMovement`/`AuditLog`). `src/lib/loyalty.ts`: `awardPointsForOrder` (dentro de la transacción que confirma el pago — webhook Stripe y `updateOrderFullStatus`; nada para checkouts de invitado), `reversePointsForOrder` (revierte en reembolso total, nunca dinero+puntos a la vez), `redeemPointsForCoupon` (canjea puntos por un cupón `FIXED` de un solo uso — reutiliza toda la validación/atomicidad de cupones ya existente en vez de tocar el checkout). Pestaña "Fidelización" en `/admin/settings` (apagado por defecto) y `/account/loyalty` (saldo, canje con vista previa, historial). Validado con Playwright + verificación directa contra `/api/storefront/coupon` (pedido de 50€ → 100 pts → canje de 50 pts → cupón de 0,50€ con el descuento exacto) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **Editor de variantes con matriz combinatoria** — **hallazgo bloqueante:** la selección de variantes en el storefront llevaba rota desde su creación. `AddToCartForm.tsx` resuelve la variante con `v.options.every(...)`; con `options: []` esto es `true` trivialmente, así que SIEMPRE resolvía la primera variante ignorando la elección real del cliente en cualquier producto con Color/Talla — `ProductVariantOption` (el pivote variante↔opción) nunca se escribía desde ningún sitio del admin, ni existía forma de crear los propios `VariantType`/`VariantOption`. Además `/admin/products/[id]/edit` no tenía ningún enlace de navegación desde el listado (`import Link` sin usar en `ProductsManager.tsx`) — sólo alcanzable tecleando la URL. Añadido: `/admin/attributes` (CRUD global de atributos y valores), `generateVariantMatrix()` (genera el producto cartesiano de las opciones elegidas, crea `ProductVariant`+`ProductVariantOption` por combinación nueva — identificada por el conjunto exacto de opciones, no por SKU, así reejecutar tras añadir un valor sólo crea lo nuevo), UI de checklist en la ficha de producto, tabla de variantes ahora muestra sus opciones, enlace "Variantes" añadido al listado. Sin cambios de schema — sólo faltaba la herramienta de administración. Validado con Playwright (crear Color/Talla → generar 4 variantes → re-generar no duplica → editar stock de dos combinaciones → en el storefront, seleccionar Rojo+S sin stock deshabilita la compra y Azul+M con stock la habilita, confirmando que la selección del cliente ahora se respeta) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- [x] **A/B testing** de hero/CTA — `AbTestEvent` (test_key/variant/event_type, anónimo, sin relación a User). `middleware.ts` asigna la variante 50/50 en la primera visita y la fija en cookie (`eshop_ab_hero`, 90 días) — un Server Component no puede escribir cookies nuevas fuera de una Server Action/Route Handler, así que la asignación vive ahí. Variante A = contenido por defecto (next-intl, sin cambios); variante B sustituye el texto sólo si el test está activo, configurable desde una nueva pestaña "A/B Testing" en `/admin/settings` (con resumen de impresiones/clicks/CTR). Impresión y click registrados con `navigator.sendBeacon` (no bloquean render ni navegación). Validado con Playwright (activar + configurar variante B → cookie forzada a B muestra el contenido y se mantiene consistente entre recargas → click en el CTA navega con normalidad → impresión y click visibles en el admin) + tsc/eslint/build limpios + suite e2e completa (19 passed/1 skipped/0 failed). ✅ 2026-09-10
- **Multi-warehouse / drop shipping** (✓ schema parcial via `StockMovement`).
- **Marketplace multi-vendor**.
- **Multi-tienda** (varios `SiteSettings` namespaces).
- **Veri*Factu (AEAT)** — la numeración correlativa actual cumple el requisito básico, pero la firma electrónica de las facturas para envío en tiempo real a la AEAT (obligatorio en España desde 2026 para algunas empresas) requiere integración con un servicio externo (Sage, Holded, B2Brouter, etc.).

---

## Calendario aproximado

Estimación original (auditoría 2026-04-30): 7–10 semanas a "producto vendible y mantenible". Realidad: cerrado en **3 días** de trabajo concentrado (2026-04-30 a 2026-05-02) gracias al alto nivel de automatización y la escala incremental.

| Fase | Estimación original | Real |
|---|---|---|
| Sprint 1 | 1–2 sem | 2026-05-01 |
| Sprint 2 | 1–2 sem | 2026-05-01 |
| Sprint 3 | 1 sem | 2026-05-01 |
| Sprint 4 | 1–2 sem | 2026-05-01 |
| Sprint 5 | 2 sem | 2026-05-02 |
| Continuo | transversal | 2026-05-02 |
| Auditoría de seguridad | — (no estimada en el plan original) | 2026-09-10 |
| Plan de migración Next.js/Prisma | — (no estimada en el plan original) | 2026-09-10 (planificación; ejecución de Fases 1-3 pendiente de disparadores) |

Próximo paso recomendado: dado que el arranque de Docker estaba roto hasta esta sesión (§ auditoría de seguridad, `--skip-generate`), **validar en un VPS de staging real es ahora más urgente que antes** — `docker compose build` y `docker compose up -d` para confirmar el flujo completo (build OK → migración auto → seed → smoke test con tarjeta `4242…`) con el fix aplicado.
