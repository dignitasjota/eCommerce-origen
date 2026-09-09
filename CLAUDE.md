# Contexto del Proyecto eCommerce

Documento de referencia del proyecto. Estado actualizado al **2026-09-10**, tras los Sprints 1–5, tareas continuas, dockerización, operativa, compliance, escala UI, pre-producción, CI/CD, drag&drop de imágenes, editor WYSIWYG (Tiptap) y una **auditoría de seguridad en profundidad con corrección + validación real de todos los hallazgos** (ver §9.9). Roadmap ejecutivo en [`ROADMAP.md`](./ROADMAP.md).

---

## 1. Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 16.1.6** (App Router, Turbopack) | Server Components por defecto |
| Lenguaje | TypeScript estricto + **React 19** | `tsc --noEmit` debe pasar siempre |
| ORM | **Prisma 7.4** + `@prisma/adapter-mariadb` | MariaDB/MySQL remota |
| Autenticación | NextAuth.js v5 (beta) | JWT, credenciales, roles `ADMIN`/`ORDER_MANAGER`/`CUSTOMER` |
| i18n | `next-intl` 4.8 | `es` (default, sin prefijo) / `en` (prefijo `/en/`) |
| Pagos | **Stripe 22** (`stripe` SDK) | Checkout Sessions + webhook firmado |
| Emails | Nodemailer | SMTP configurable desde `SiteSettings` |
| Estilos | Tailwind CSS v4 + CSS variables propias (`globals.css`) | DaisyUI purgada (sólo se usaban dos primitivas; reescritas en CSS) |
| Sanitización | `isomorphic-dompurify` 3 | Aplicado al guardar y al renderizar |
| Validación | `zod` 4 | Schemas centralizados en `src/lib/schemas/` |
| Editor rico | `@tiptap/react` 2 + StarterKit + Link/Image/Placeholder/TextAlign | Output HTML, sanitizado en server. Preserva shortcodes `{{...}}` |
| Tests E2E | `@playwright/test` | 6 specs cubren flujos críticos. `webServer` arranca dev auto |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) | quality + e2e + docker-build + docker-publish (a GHCR en tags) |

---

## 2. Entorno de Producción (Docker / Portainer)

Plantilla dockerizada para **multi-instancia**: cada cliente despliega su propio stack en un VPS con Portainer. Componentes:

- **`app`** — imagen multi-stage (deps → build → runner), Next.js en modo `standalone` (~250 MB final).
- **`db`** — MariaDB 10.11 sobre volumen `db-data`.
- **Reverse proxy externo** — Traefik / Caddy / nginx-proxy-manager fuera del compose, gestiona TLS.

**Deploy = `docker compose up -d`.** El `docker-entrypoint.sh` se autoconfigura en cada arranque:

1. Espera a la BD (hasta 60 s).
2. `prisma db push --accept-data-loss=false` (idempotente).
3. `seed-bootstrap.mjs` (idempotente): `SiteSettings` por defecto, categoría raíz, admin inicial **si no hay ninguno**.
4. Lanza `node server.js`.

**Volúmenes persistentes:** `db-data`, `uploads` (imágenes admin), `themes` (CSS custom subidos).

**Variables de entorno** (sólo lo imprescindible — el resto va en `SiteSettings`, editable desde admin):

- `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`.
- `MYSQL_*` (sólo para el contenedor `db`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (bootstrap del primer admin; password se autogenera y aparece en logs si no se fija).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: **opcionales** — preferiblemente se configuran desde `/admin/settings`. Las env vars actúan como fallback.

**Single-process por contenedor.** Rate limiter y cache de Stripe son por-proceso (válidos; migrar a Redis si se replica horizontal).

Detalles operativos:
- [`docs/deploy-portainer.md`](./docs/deploy-portainer.md) — guía paso a paso completa para VPS con Portainer (DNS, reverse proxy, smoke test, backups, troubleshooting).
- [`docs/deploy-docker.md`](./docs/deploy-docker.md) — referencia rápida Docker / Portainer.
- **Single-process:** la instancia de Passenger es típicamente single-process. El rate limiter y el cache de Prisma son por-proceso (válidos en este entorno; migrar a Redis si se replica).

---

## 3. Estructura del Proyecto

### Raíz

```
.
├── Dockerfile                  # Multi-stage build (deps → build → runner)
├── docker-compose.yml          # app + MariaDB + volúmenes persistentes (+ profile backup)
├── .dockerignore
├── .env.docker.example         # Plantilla de variables para compose
├── next.config.ts              # output:'standalone' para imagen ligera
├── playwright.config.ts        # webServer arranca npm run dev o respeta E2E_BASE_URL
├── .github/
│   └── workflows/ci.yml        # CI/CD: quality + e2e + docker-build + docker-publish
├── prisma/
│   ├── schema.prisma           # Modelo completo
│   └── migrations-pending.sql  # Snapshot de referencia del SQL acumulado
├── scripts/
│   ├── docker-entrypoint.sh    # Bootstrap del contenedor (wait db → push → seed → run)
│   ├── seed-bootstrap.mjs      # Seed mínimo idempotente
│   └── dev/                    # Utilidades de desarrollo
├── tests/
│   └── e2e/                    # 7 specs Playwright (consent, browse, checkout, admin, register, stripe-webhook)
├── docs/
│   ├── deploy-portainer.md     # Guía paso a paso completa (DNS, proxy, smoke test, backups)
│   ├── deploy-docker.md        # Referencia rápida Docker / Portainer
│   ├── deploy-vps.md           # (legacy, despliegue VPS plano)
│   ├── monitoring.md           # UptimeRobot/BetterStack sobre /api/health y /api/health/deep
│   └── observability.md        # Setup de Sentry (errores no controlados, opcional)
└── src/                        # Código de la app
    ├── instrumentation.ts                # Hook Next: inicializa Sentry server (no-op sin DSN)
    ├── instrumentation-client.ts         # Hook Next cliente: Sentry browser (no-op sin DSN)
    └── …
```

### `src/` — código de la aplicación

```text
src/
├── middleware.ts                        # next-intl + redirect-on-rewrite
├── app/
│   ├── layout.tsx                       # Root layout (vacío, mete los CSS)
│   ├── sitemap.ts                       # Dinámico: priority/changeFreq por recencia
│   ├── robots.ts
│   ├── api/
│   │   ├── auth/[...nextauth]/          # NextAuth handler
│   │   ├── health/                      # /api/health (SELECT 1 + uptime) y /api/health/deep (config checks)
│   │   ├── webhooks/stripe/             # Webhook firmado, idempotente vía WebhookEvent
│   │   ├── admin/
│   │   │   ├── orders/export/           # CSV admin (requireAdmin)
│   │   │   ├── orders/[id]/invoice.pdf/ # PDF factura (admin u owner) con pdfkit
│   │   │   └── cron/
│   │   │       ├── cleanup-pending-orders/  # Libera stock+cupón de PENDING_PAYMENT vencidos
│   │   │       ├── abandoned-carts/         # Email recuperación a carritos en ventana 24-26h
│   │   │       └── retention/               # Purga WebhookEvent/AuditLog/StockMovement antiguos
│   │   └── storefront/
│   │       ├── checkout/                # Stripe / COD / TRANSFER, stock atómico, cupón atómico
│   │       ├── coupon/                  # Dry-run de cupón (rate-limit)
│   │       ├── search/                  # Autocomplete header (rate-limit)
│   │       ├── newsletter/              # POST + /confirm con doble opt-in
│   │       ├── cart/merge/              # Fusión carrito anónimo ↔ DB al login
│   │       ├── register/, forgot-password/, reset-password/, wishlist/, reviews/
│   └── [locale]/
│       ├── layout.tsx                   # hreflang global, metadataBase
│       ├── (backoffice)/admin/          # Panel cerrado (rol ADMIN/ORDER_MANAGER)
│       │   ├── dashboard/               # KPIs 30d + gráfico SVG inline + top productos
│       │   ├── products/                # Listado paginado + editor + variantes CRUD
│       │   ├── orders/                  # Filtros server-side + CSV export + cursor pagination
│       │   ├── returns/                 # Flujo RMA con integración Stripe refunds
│       │   ├── audit-logs/              # Visor inmutable (sólo ADMIN, cursor pagination)
│       │   ├── users/, blog/, pages/, categories/, coupons/,
│       │   ├── shipping/, payments/, legal/, settings/
│       └── (storefront)/                # Tienda pública
│           ├── page.tsx                 # Home: carousel + featured + recently-viewed + newsletter
│           ├── product/[slug]/          # Cache() compartido con generateMetadata, BreadcrumbList JSON-LD
│           ├── category/[slug]/         # Filtros (precio/sort) sin selector de categoría
│           ├── products/                # Catálogo con filtros + autocomplete
│           ├── cart/, checkout/         # Cupón UI, Stripe redirect, hidratación sin CLS
│           ├── checkout/success/[orderId]/
│           ├── blog/, blog/[slug]/      # Article JSON-LD
│           ├── account/                 # profile, addresses, orders, wishlist
│           ├── auth/                    # login, register, forgot-password, reset-password
│           └── [...dynamicSlug]/        # Catch-all: legal pages, pages dinámicas con shortcodes
├── components/
│   ├── storefront/
│   │   ├── Header.tsx + HeaderClient.tsx + SearchAutocomplete.tsx
│   │   ├── Footer.tsx, CartDrawer.tsx, HomeCarousel.tsx
│   │   ├── ProductGallery.tsx, AddToCartForm.tsx, AddToCartClientButton.tsx
│   │   ├── WishlistButton.tsx, ReviewForm.tsx
│   │   ├── ProductFilters.tsx          # sort + precio + categoría (cliente, URL = source of truth)
│   │   ├── NewsletterForm.tsx          # Cliente con estados + lectura de flag URL
│   │   └── RecentlyViewed.tsx          # SC que lee cookie eshop_recent
│   ├── backoffice/
│   │   ├── AdminLayoutClient.tsx, AdminSidebar.tsx, ThemeProvider.tsx
│   │   ├── AdminPagination.tsx         # Offset-based: ventana adaptativa con elipsis
│   │   ├── CursorPagination.tsx        # Cursor-based: para listados que crecen sin límite
│   │   ├── ImageUploader.tsx           # Drag & drop + preview + reorder + delete (HTML5 nativo)
│   │   ├── RichTextEditor.tsx          # Tiptap WYSIWYG (output HTML, sanitizado server-side)
│   │   └── RevenueChart.tsx            # SVG inline, sin recharts
│   └── shared/
├── context/
│   └── CartContext.tsx                  # localStorage + fusion con DB al login (userId prop)
├── i18n/
│   ├── navigation.ts                    # Link, useRouter, redirect, usePathname
│   ├── request.ts                       # getRequestConfig (locale + timezone Madrid)
│   └── messages/                        # es.json, en.json
├── lib/
│   ├── auth.ts                          # NextAuth + requireAdmin() + AuthorizationError
│   ├── auth-roles.ts                    # ADMIN_ROLES/AdminRole — sin deps de Prisma, para middleware.ts
│   ├── db.ts                            # PrismaClient singleton
│   ├── stripe.ts                        # getStripe() async (lee SiteSettings + cache 60s)
│   ├── coupons.ts                       # resolveCoupon (puro) + consumeCoupon (atómico)
│   ├── sanitize.ts                      # sanitizeHtml, sanitizeText (DOMPurify)
│   ├── rate-limit.ts                    # En memoria, por (bucket+IP)
│   ├── shortcodes.ts                    # parseShortcodes() → AST plano (html|shortcode)
│   ├── recently-viewed.ts               # cookie eshop_recent (12 slugs, 30d)
│   ├── pagination.ts                    # keyset real (created_at+id) — CURSOR_ORDER_BY + buildCursorWhere
│   ├── uploads.ts                       # saveUploadedImage(): whitelist MIME + magic bytes + nombre server-side
│   ├── audit.ts                         # auditLog() + auditLogServer() best-effort
│   ├── stock.ts                         # recordStockMovement() (acepta tx)
│   ├── invoice.ts                       # generateInvoiceNumber + ensureInvoiceNumber
│   ├── invoice-pdf.ts                   # buildInvoicePdf() con pdfkit
│   ├── cron-auth.ts                     # verifyCronAuth() (timing-safe + fail-safe)
│   ├── email.ts                         # sendEmail()
│   ├── emails/
│   │   ├── notify.ts                    # sendOrderStatusEmail()
│   │   ├── order-confirmation.ts, order-status-update.ts
│   │   ├── password-reset.ts, newsletter-confirm.ts
│   │   └── abandoned-cart.ts            # Email de recuperación de carrito
│   └── schemas/                         # Zod por entidad
│       ├── index.ts (exports)
│       ├── auth.ts (register, forgot, reset)
│       ├── checkout.ts (checkout, couponDryRun)
│       └── newsletter.ts
├── styles/
│   ├── globals.css                      # CSS variables, focus-visible, skip-to-content
│   └── …
├── themes/
│   └── default/theme.css
└── types/
    └── admin.ts                         # Prisma.GetPayload con `satisfies` para managers admin
```

---

## 4. Modelo de datos

Internacionalización en BD con tablas hijas `*_translations` unidas por `locale`. La tabla principal contiene precio/stock/flags; los textos van en la traducción.

### Entidades core

- **`Product`** — `slug`, `sku` UNIQUE, `barcode`, `price`, `compare_at_price`, `weight` (Decimal 8,3), `dimensions` (JSON `{w,h,d}`), `is_active`, `is_featured`, `unlimited_stock`. Relaciona con `ProductTranslation`, `ProductImage`, `ProductCategory`, `ProductVariant`, `Review`, `RelatedProduct`.
- **`ProductVariant`** — SKU UNIQUE, precio override (null = hereda), stock, `is_active`. Pivot con `VariantOption` vía `ProductVariantOption`. **Stock real por variante** desde Sprint 5 (CRUD plano en admin).
- **`Category`** — `slug` UNIQUE, jerarquía con `parent_id`, traducciones independientes, `image`, `sort_order`, `is_active`.
- **`Order`** — `order_number` UNIQUE (`ORD-YYYYMM-XXXXXXXX`, no enumerable), `status` (enum `OrderStatus` que incluye `PENDING_PAYMENT`), `payment_status`, `fulfillment_status` (enum `FulfillmentStatus` separado), `payment_method`, `payment_id`, `payment_intent_id` UNIQUE (Stripe), `invoice_number` UNIQUE, `invoice_url`, `subtotal/shipping_cost/discount/tax/total`, `coupon_id`, `tracking_number`, `locale`, `delivered_at` (nullable, 2026-09-10 — fijado sólo al entrar en `DELIVERED`, base de la ventana de devolución; ver §9.9). Relaciones con `User`, `Address` (shipping/billing), `ShippingMethod`, `OrderItem`, `Coupon`. Índice en `created_at` (usado por la paginación cursor de `/admin/orders` y por el cron `cleanup-pending-orders`).
- **`Coupon`** — `code` UNIQUE, `discount_type` (PERCENTAGE/FIXED), `discount_value`, `min_purchase`, `max_uses`, `used_count`, `starts_at`, `expires_at`, `is_active`. Validación + consumo atómico con guardia de `used_count < max_uses`.
- **`User`** — `email` UNIQUE, `password_hash`, `name`, `phone`, `role` (`ADMIN`/`ORDER_MANAGER`/`CUSTOMER`), `is_active`, `last_login_at`, `image`. Relaciones con `Address`, `Order`, `CartItem`, `Review`, `WishlistItem`, `Account`, `Session`.
- **`Address`** — `tax_id` (NIF/CIF) añadido para facturación legal en España. Resto: `first_name`/`last_name`, `address1`/`address2`, `city`/`state`/`postal_code`/`country`, `phone`, `is_default`, `user_id` opcional (admite invitado).
- **`Review`** — `rating` (1-5), `title`, `comment`, `images` (JSON URLs), `is_approved`, `is_verified_purchase` (auto-true si hay OrderItem PAID del mismo producto). Unique `(user_id, product_id)`.
- **`Page` / `LegalPage`** — slug UNIQUE, traducciones con `title`+`content` LongText. El catch-all `[...dynamicSlug]` resuelve primero `LegalPage` y luego `Page` con prefijo opcional desde `SiteSetting.pages_prefix`.
- **`BlogPost`** — slug UNIQUE, `image`, `is_published`, `published_at`, traducciones con `excerpt`/`content`/`meta_*`.
- **`SiteSetting`** — clave/valor LongText con `type`. Almacén de configuración global (SMTP, branding, feature flags, prefijos, currency...).

### Entidades operativas (añadidas en sprints 1–5 + continuo)

- **`WebhookEvent`** — `(provider, event_id)` UNIQUE → idempotencia de webhooks Stripe. Insertar el `event.id` antes de procesar; `P2002` ⇒ duplicado, devolver 200.
- **`Subscriber`** — alta de newsletter con doble opt-in. `email` UNIQUE, `confirm_token` UNIQUE (256 bits hex), `confirmed_at`, `unsubscribed_at`, `locale`.
- **`AuditLog`** — `(user_id, action, entity_type, entity_id, metadata JSON, ip_address, created_at)`. Índices por `user_id`, `(entity_type, entity_id)`, `created_at`. Cableado en server actions — ver §5.7.
- **`StockMovement`** — `(variant_id, quantity ±, reason, reference_id, note, user_id)`. Enum `StockMovementReason`: `PURCHASE | REFUND | ADJUSTMENT | RESTOCK | RESERVATION_RELEASE`. Cableado — ver §5.8.

### Patrón "tablas de traducción"

```ts
prisma.product.findUnique({
  where: { slug },
  include: {
    product_translations: { where: { locale } } // siempre filtrar por locale
  }
})
// y luego: product.product_translations[0]?.name
```

En **updates** que afectan a tabla base + traducción → siempre dentro de `prisma.$transaction([])`.

---

## 5. Flujos críticos

### 5.1. Checkout

`POST /api/storefront/checkout` (rate-limit 10/min):

1. **Valida formato** con `checkoutSchema.safeParse()` (Zod, `src/lib/schemas/checkout.ts`) — hasta 2026-09-10 el endpoint reimplementaba la validación a mano (regex de email propia, campos de dirección uno a uno) ignorando el schema ya centralizado; `attributes` de cada item ahora está tipado como `Record<string,string>` (sin anidamiento posible) en vez de `JSON.stringify` sobre un objeto sin validar. Items ≤ 100, dirección con campos requeridos, email si no hay sesión.
2. **Rehidrata catálogo desde DB**: por cada item lee `product` + `variant` con `is_active=true`, **ignora `name`/`price` del cliente**. Si `unlimited_stock=false`, valida stock; precio definitivo viene de variant ?? product.
3. **Cupón** (opcional): `resolveCoupon(prisma, code, subtotal)` valida `is_active`/`starts_at`/`expires_at`/`max_uses`/`min_purchase` y devuelve descuento. Acotado a `[0, subtotal]` y redondeado a céntimos.
4. **Transacción atómica** (`prisma.$transaction`):
   - Crear `Address` permanente.
   - Crear `Order` con `status=PENDING_PAYMENT` (Stripe) o `PENDING` (COD/TRANSFER), `coupon_id`.
   - Decremento stock con `updateMany({ where: { id, stock: { gte: q } } })` — `count !== 1` ⇒ `throw 'Stock insuficiente'` ⇒ rollback.
   - `recordStockMovement(PURCHASE)` por cada variante en la misma transacción.
   - `consumeCoupon(tx, coupon)` con `updateMany({ where: { id, used_count: { lt: max_uses } } })` — count !== 1 ⇒ rollback.
5. **Si Stripe**: crea Checkout Session con `metadata.order_id`, persiste `payment_intent_id` y `payment_id`. Devuelve `{ checkoutUrl }`.
6. **Si COD/TRANSFER**: envía email confirmación inmediato y devuelve `{ orderId }`.

Errores controlados: `409` para `Stock insuficiente` o `Cupón agotado`; `400` para datos inválidos; `502` si Stripe falla; `500` para errores no clasificados (sin filtrar stack al cliente).

### 5.2. Webhook Stripe

`POST /api/webhooks/stripe`:

1. **Cargar webhook secret** desde `SiteSettings` (con fallback a env). Si no hay → 500.
2. **Verificar firma** con `stripe-signature` (lee `req.text()` raw).
3. **Idempotencia**: insertar `WebhookEvent(provider='stripe', event_id)` — `P2002` ⇒ ya procesado, devolver 200.
4. **Handlers** (reescritos 2026-09-10, ver §9.9):
   - `checkout.session.completed`, `async_payment_succeeded` → orden `CONFIRMED + PAID` + `ensureInvoiceNumber()` + email confirmación.
   - `async_payment_failed`, `expired`, **`payment_intent.canceled`** → `revertOrderReservation()`: restituye stock, revierte `coupon.used_count` (guard `gt: 0`) y marca `CANCELLED + FAILED`, todo en una transacción con guard atómico (`updateMany` + `count===1`) — mismo patrón que el cron `cleanup-pending-orders`. Antes dejaba la orden en `CANCELLED` sin revertir nada, fuera del alcance de ese cron (que sólo mira `PENDING_PAYMENT`) ⇒ fuga permanente de stock y cupón en todo pago Stripe fallido/expirado.
   - `charge.refunded` → `handleChargeRefunded()`: distingue reembolso parcial de total comparando `amount_refunded` vs `amount`; consulta `stripe.refunds.list()` para detectar si el reembolso ya lo gestionó el flujo RMA (`refundReturn`, que restituye stock por ítem) y evitar duplicar la restitución; un reembolso total fuera del flujo RMA sigue el comportamiento legacy (restituye todo el stock, marca `REFUNDED`, revierte cupón); un parcial sin RMA no toca stock ni estado — sólo deja `AuditLog(order.partial_refund_unmanaged)` para revisión manual.

### 5.3. Carrito

- **Anónimo:** localStorage (`eshop_cart`) gestionado por `CartContext` (reducer + provider).
- **Login:** el server layout pasa `userId` al provider. Al detectar transición, `POST /api/storefront/cart/merge` valida productos activos, **suma cantidades** por `(product_id, variant_id)`, recomputa precios desde DB y reescribe `cart_items`. Flag `eshop_cart_merged_for=<userId>` en localStorage evita repetir la fusión en cada navegación.

### 5.4. Páginas dinámicas (`[...dynamicSlug]`)

1. Resuelve `LegalPage` por slug → render directo si match.
2. Si no, lee `SiteSetting.pages_prefix` (con guard `prefix !== 'null'` por bug histórico).
3. Resuelve `Page` con/sin prefijo según el ajuste.
4. Renderiza `content` pasándolo por `parseShortcodes()` (AST plano `html|shortcode`).
   - `html` → `dangerouslySetInnerHTML` con `sanitizeHtml()` (defensa en profundidad).
   - `shortcode { name: 'category_id', arg: slug }` → `<CategoryBlock>`.
5. Añadir un nuevo shortcode = añadir variante a `ShortcodeNode` + caso al renderer.

### 5.5. Autorización

- **Rutas admin (URL):** `src/middleware.ts` decodifica el JWT de sesión con `getToken()` de `next-auth/jwt` (no pasa por `auth()`/`PrismaAdapter` para no arrastrar el driver de MariaDB al bundle del middleware) y bloquea/redirige a login cualquier request a `/admin/*` (con o sin prefijo de locale) sin rol `ADMIN`/`ORDER_MANAGER`. Fail-safe: sin `AUTH_SECRET`/`NEXTAUTH_SECRET` configurado, deniega siempre. **Nota histórica:** hasta el 2026-09-10 esta protección era código muerto — el callback `authorized` de NextAuth existía en `src/lib/auth.ts` pero `middleware.ts` nunca lo invocaba (sólo ejecutaba `next-intl`), dejando **todo** el panel admin (incluidas las claves de Stripe/SMTP en `/admin/settings`) visible sin login. Ver §9.9.
- **Server Actions admin:** TODAS las server actions invocan `requireAdmin([roles])` al inicio. Sin `auth()` válido lanza `AuthorizationError` que el catch convierte en `{ success:false, error }`. Roles granulares: `['ADMIN']` para settings/users/payments/coupons/shipping/legal/categories; default `[ADMIN, ORDER_MANAGER]` para products/orders/pages/blog. Un admin no puede borrarse a sí mismo.
- **Endpoints de cron:** `verifyCronAuth(req)` compara `x-cron-secret` con `CRON_SECRET` usando `timingSafeEqual`. Sin `CRON_SECRET` configurado, **rechaza todas las peticiones** (fail-safe) — los crons quedan deshabilitados hasta configurar la variable.

### 5.6. Crones de mantenimiento

Todos los endpoints `POST /api/admin/cron/*` requieren cabecera `x-cron-secret: $CRON_SECRET`.

#### `cleanup-pending-orders` (frecuencia: cada 5 min)

Limpia órdenes `PENDING_PAYMENT` con `created_at < now-30min`. Por cada una en transacción:
- Restituye stock con `productVariant.update(increment)` y registra `StockMovement RESERVATION_RELEASE`.
- Decrementa `coupon.used_count` si tenía cupón.
- Marca orden `CANCELLED + payment_status FAILED` (con guard `where: { status: 'PENDING_PAYMENT' }` para idempotencia).
- Registra `AuditLog action='order.cleanup_expired'`.

Sin esto, las órdenes que el cliente abandona en Stripe Checkout dejan stock reservado indefinidamente. Batch máximo 100 órdenes por ejecución; si una falla, las demás continúan.

#### `abandoned-carts` (frecuencia: cada hora)

Selecciona `cart_items` con `updated_at` en ventana **24h-26h** (sólo coincide una vez en su vida útil → evita duplicados sin estado adicional). Excluye usuarios con order reciente. Envía email `getAbandonedCartEmailHtml` y registra `AuditLog action='cart.abandonment_reminder'`.

#### `retention` (frecuencia: diaria)

Purga registros antiguos de tablas que crecen sin límite. Ventanas configurables vía `SiteSettings` con defaults sensatos:
- `WebhookEvent` → 90 días (`retention_webhook_event_days`).
- `AuditLog` → 365 días (`retention_audit_log_days`).
- `StockMovement` → 730 días (`retention_stock_movement_days`).

Cada `deleteMany` es independiente y best-effort: si una tabla falla, las demás continúan. Registra `AuditLog action='cron.retention'` con counts y total. Sin esto, las tres tablas degradan el rendimiento a partir de 6-12 meses de tráfico.

### 5.7. AuditLog

`src/lib/audit.ts` expone:
- `auditLog({ action, entity_type, entity_id, metadata })` — para server actions; lee sesión y headers.
- `auditLogServer(...)` — para webhooks/crons sin sesión.

**Best-effort:** si la BD falla o no hay sesión, loguea por consola y continúa — el audit nunca rompe una operación funcional. Cableado en: products (create/update/delete), orders (update_status), users (create/update/delete), settings (sólo `keys`, no valores), coupons (create/update/delete), variants (create/update), cron de cleanup, cron de abandoned carts.

Para añadir un audit nuevo: invocar `auditLog({...})` **DESPUÉS** de la operación principal — sólo registramos lo que se persistió.

### 5.8. StockMovement

`src/lib/stock.ts` expone `recordStockMovement({ variant_id, quantity ±, reason, reference_id, note, user_id }, tx?)`:
- Acepta opcionalmente un `tx` (cliente de transacción Prisma) → el log entra y sale con la transacción.
- Best-effort en errores; el inventario "real" vive en `ProductVariant.stock`, este log es para auditoría/reportes.

| `reason` | Cuándo |
|---|---|
| `PURCHASE` | Checkout decrementa stock (negativo). |
| `REFUND` | Webhook `charge.refunded` restituye stock (positivo). |
| `RESERVATION_RELEASE` | Cron `cleanup-pending-orders` restituye stock (positivo). |
| `RESTOCK` | Editor de variantes (admin) sube stock manualmente (positivo). |
| `ADJUSTMENT` | Editor de variantes baja stock manualmente (negativo). |

### 5.9. Facturas

- `src/lib/invoice.ts` — `generateInvoiceNumber()` produce `INV-YYYY-XXXXXXXX` (8 hex, ~4·10⁹ por año). `ensureInvoiceNumber(db, orderId)` es idempotente: devuelve el existente o asigna uno nuevo con reintento ante P2002.
- Asignación lazy: el webhook al confirmar pago llama a `ensureInvoiceNumber`. Si por alguna razón la orden ya estaba PAID antes (COD/TRANSFER → admin marca PAID a mano), el endpoint de descarga lo asigna al primer acceso.
- `src/lib/invoice-pdf.ts` — `buildInvoicePdf(data)` construye el PDF con **pdfkit** (A4, fuentes built-in, sin logos). Cabecera, vendedor/comprador, tabla items, totales, pie.
- `GET /api/admin/orders/[id]/invoice.pdf` — autorización: admin/order_manager o **dueño de la orden**. Para usuarios no-admin requiere `payment_status === 'PAID'` (sin sentido fiscal antes). Datos del vendedor desde `SiteSettings`: `invoice_seller_tax_id`, `invoice_seller_address`, `invoice_seller_email`.

> ⚠️ **Aviso fiscal:** la numeración aleatoria descrita arriba **fue sustituida** en el bloque Compliance (2026-05-02) por `InvoiceCounter` con secuencia atómica `<SERIE>-YYYY-NNNNNNN`. Ver §9.6.

### 5.10. Subida y galería de imágenes (admin)

`src/components/backoffice/ImageUploader.tsx` (cliente):
- **Drop zone** con click/keyboard/paste desde portapapeles. Validación de tipo (`image/*`) y tamaño (default 8 MB) por archivo — **sólo UX**, no es la defensa real (ver abajo).
- **Preview** con `URL.createObjectURL(file)` — revocado al desmontar para no leakear memoria.
- **Reorder** de imágenes existentes con HTML5 native drag (sin librerías). La primera (`sort_order=0`) es la principal.
- **Delete reversible** con toggle (×/↺); el cambio sólo se persiste al enviar el form.
- **Sync con FormData**: un input file oculto se actualiza vía `DataTransfer` con los archivos seleccionados → `new FormData(form)` los recoge automáticamente. Un input hidden serializa el orden y deletes en JSON (`images_order`).

**Validación real: `src/lib/uploads.ts` → `saveUploadedImage()`** (2026-09-10). Antes las server actions derivaban la extensión de `file.name.split('.').pop()` sin whitelist ni comprobación de tipo real — cualquier archivo (incl. `.html`/`.svg`, servidos luego como estático desde `/uploads/`, riesgo de XSS almacenado) pasaba. Ahora:
1. Valida `file.type` contra whitelist (`image/jpeg|png|webp|gif`).
2. Comprueba los **magic bytes reales** del contenido — el `file.type` declarado por el cliente no es de fiar.
3. Límite de tamaño server-side (8 MB por defecto — antes sólo existía en cliente).
4. Genera el nombre de archivo **íntegramente en el servidor** (prefijo + UUID) — nunca usa `file.name` del cliente, ni para el nombre ni para la extensión.

Server actions consumidoras (`products`, `categories`, `blog`, `settings` — logo/favicon/carrusel):
1. Parsean `images_order` (best-effort: si malformed, ignoran).
2. Aplican deletes (con borrado físico de `/uploads/` si el archivo es nuestro).
3. Aplican reorder con `updateMany` por id en transacción.
4. Suben los archivos nuevos al final con `saveUploadedImage()`, `sort_order` consecutivo desde el `MAX` actual.

`next.config.ts` fija `experimental.serverActions.bodySizeLimit: '32mb'` — el default de Next (1 MB) rompía cualquier subida por encima de eso pese a que el uploader promete hasta 8 MB por imagen y la galería permite subir varias a la vez.

Casos de un solo archivo (categorías, blog cover): el ImageUploader se monta con `multiple={false}` y un `existingImages` sintético `[{id:'current', url, sort_order:0}]`. La server action interpreta `{id:'current', deleted:true}` como "borrar la actual sin reemplazo".

### 5.11. Editor WYSIWYG (Tiptap)

`src/components/backoffice/RichTextEditor.tsx` (cliente):
- **Extensions:** StarterKit (headings h2/h3, listas, bold/italic/strike/code/blockquote/hr/historial), Link (target=_blank rel=noopener noreferrer), Image (URL externa, no base64), Placeholder, TextAlign.
- **Output HTML** (no JSON): mantiene compatibilidad con `sanitizeHtml` server-side y con los shortcodes `{{category_id:slug}}` ya existentes (Tiptap los preserva como texto plano dentro del HTML).
- **`immediatelyRender: false`** evita mismatch SSR ↔ CSR (Tiptap genera markup distinto en cliente). Mientras `useEditor()` devuelve `null`, mostramos un fallback "Cargando editor…".
- **Sync externa** con `useEffect`: si el padre cambia `value` (p. ej. al abrir el modal con otro post), invocamos `editor.commands.setContent(value, false)` con `emitUpdate=false` para no disparar `onChange` en bucle.
- **Toolbar** con grupos visuales separados por borde lateral: formato (H2/H3/¶, B/I/S/code), listas/cita, alineación, link/img/hr, deshacer/rehacer. `aria-pressed` en botones activos para a11y.

Aplicado en: `ProductsManager` (description), `BlogManager` (content), `PagesManager` (content) y `LegalManager` (content). El `excerpt` del blog sigue siendo `<textarea>` (texto plano para meta descripción). El padre es responsable de pasar el HTML por `sanitizeHtml` antes de guardar (los actions ya lo hacen).

---

## 6. Operativa y deploy

### 6.1. Variables de entorno

**Sólo lo imprescindible** va en env vars. El resto (Stripe, SMTP, branding, SEO defaults) vive en `SiteSettings` y se edita desde el panel admin.

```bash
# ── Inevitable en env (compose) ──────────────────────────────────────
DATABASE_URL="mysql://USER:PASS@db:3306/DB_NAME"   # interno docker
NEXTAUTH_URL="https://tienda.tucliente.com"        # dominio público
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXT_PUBLIC_APP_URL="https://tienda.tucliente.com" # = NEXTAUTH_URL

# ── Sólo para el contenedor `db` ────────────────────────────────────
MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD

# ── Bootstrap del primer admin (sólo se usa si BD está vacía) ───────
ADMIN_EMAIL="admin@tucliente.com"
ADMIN_PASSWORD=""   # vacío → autogenerada en logs

# ── Crones (jobs de mantenimiento) ──────────────────────────────────
# Generar con: openssl rand -hex 32
# Sin valor → endpoints /api/admin/cron/* rechazan todas las peticiones.
CRON_SECRET=""

# ── Opcionales (fallback si no están en SiteSettings) ───────────────
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
```

Plantilla completa en [`.env.docker.example`](../.env.docker.example).

### 6.2. Esquema de BD (auto-aplicado)

El entrypoint del contenedor ejecuta `prisma db push` en cada arranque. Resultado:

- **En BD vacía:** crea TODO el schema de cero (todas las tablas y enums actuales).
- **En BD existente:** aplica el diff de forma idempotente. Como todos los cambios actuales son aditivos (`ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`), no hay riesgo de pérdida de datos. La flag `--accept-data-loss=false` aborta si Prisma detectara una operación destructiva (no debería ocurrir con cambios aditivos).

### 6.3. Configuración Stripe (post-deploy, desde el admin)

1. Crear cuenta Stripe / usar la del cliente.
2. **API keys** → copiar `sk_live_…` (o `sk_test_…` en pruebas).
3. **Developers → Webhooks → Add endpoint** → `https://tudominio.com/api/webhooks/stripe`.
4. Seleccionar 6 eventos: `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`, `charge.refunded`, `payment_intent.canceled`.
5. Copiar **Signing secret** (`whsec_…`).
6. En `/admin/settings` (o donde se cablee): pegar `stripe_secret_key` y `stripe_webhook_secret`. El cache se invalida en ≤ 60 s o al reiniciar el contenedor.
7. Smoke test: tarjeta `4242 4242 4242 4242`, cualquier CVC, fecha futura.

### 6.4. Limpieza obligatoria de la raíz (regla heredada)

NUNCA dejar scripts `*.ts`/`*.mjs`/`*.js` sueltos en la raíz del proyecto: rompen el `next build` en cualquier entorno. El `.gitignore` los bloquea (`/test_*`, `/check-*`, `/create-*`, `/fix_*`, `/query_*`, `/seed_*`, `/curl_output.*`, `/*.log`, `/dev_output.*`, `/build_output.*`). Scripts de utilidad van en `scripts/dev/`. Documentación operativa en `docs/`.

### 6.5. Configuración de crones

Los endpoints `POST /api/admin/cron/*` (ver §5.6) ya están implementados pero **no se ejecutan solos**. Hay que dispararlos desde fuera. Dos opciones:

**Opción A — cron-job.org (gratis, externo):**
1. Crear cuenta y añadir 2 jobs:
   - URL: `https://tienda.cliente.com/api/admin/cron/cleanup-pending-orders`, frecuencia **5 min**, método POST, cabecera `x-cron-secret: <CRON_SECRET>`.
   - URL: `https://tienda.cliente.com/api/admin/cron/abandoned-carts`, frecuencia **1 h**, igual.
   - URL: `https://tienda.cliente.com/api/admin/cron/retention`, frecuencia **diaria** (típicamente de madrugada), igual.

**Opción B — side-car en `docker-compose.yml`:**
```yaml
  cron:
    image: alpine:3.19
    restart: unless-stopped
    depends_on: [app]
    environment:
      CRON_SECRET: "${CRON_SECRET}"
    command: >
      sh -c "
      apk add --no-cache curl &&
      echo '*/5 * * * * curl -fsS -X POST -H \"x-cron-secret: $$CRON_SECRET\" http://app:3000/api/admin/cron/cleanup-pending-orders' > /etc/crontabs/root &&
      echo '0 * * * *   curl -fsS -X POST -H \"x-cron-secret: $$CRON_SECRET\" http://app:3000/api/admin/cron/abandoned-carts'        >> /etc/crontabs/root &&
      echo '15 4 * * *  curl -fsS -X POST -H \"x-cron-secret: $$CRON_SECRET\" http://app:3000/api/admin/cron/retention'              >> /etc/crontabs/root &&
      crond -f -L /dev/stdout
      "
    networks: [ecommerce-net]
```

### 6.6. CI/CD (GitHub Actions)

`.github/workflows/ci.yml` define 4 jobs:

| Job | Disparador | Qué hace |
|---|---|---|
| `quality` | `push`/`pr` a `main`, manual | `npm ci --ignore-scripts` + `prisma generate` (con DATABASE_URL placeholder) + `tsc --noEmit` + `eslint`. Lint en `continue-on-error` hasta limpiar warnings legacy. |
| `e2e` | `push`/`pr` a `main` | Levanta service `mariadb:10.11` efímero, instala browsers Playwright (chromium), `prisma db push --accept-data-loss=false` + `seed-bootstrap.mjs` con admin determinista (`ci-admin@example.com` / `CiTestPass123!`), build de Next y `npm run test:e2e`. Sube `playwright-report/` como artefacto si falla. |
| `docker-build` | `push`/`pr` a `main` (depende de `quality`) | `docker buildx build` con cache `type=gha` y smoke test (`docker run --entrypoint node ... --version`). No publica. |
| `docker-publish` | Sólo en tags `v*.*.*` (depende de `quality`+`docker-build`) | Login a `ghcr.io` con `GITHUB_TOKEN` y push de `ghcr.io/<repo>:latest` y `:vX.Y.Z`. |

`concurrency` cancela runs antiguos cuando llega un push nuevo a la misma rama. El `tests/`, `playwright.config.ts` y `playwright-report/` están excluidos vía `.dockerignore` para no inflar la imagen.

### 6.7. Pendientes operativos restantes

- **Monitorización externa** (UptimeRobot u otro) sobre `/api/health` y la home pública.

---

## 7. Filosofía y directrices para la IA / equipo

### 7.1. Decisiones de diseño consolidadas

- **El servidor es la fuente de verdad de precios y stock.** El cliente envía intención (qué producto/variante en qué cantidad), no valores. Cualquier endpoint que toque dinero debe releer desde DB.
- **Atomicidad para invariantes críticas.** Stock y `used_count` se actualizan con `updateMany` + filtro de guardia dentro de transacción. Si `count !== 1`, abortar y dejar que la transacción haga rollback.
- **URL = fuente de verdad para listados.** Filtros, sort y paginación viajan en searchParams. Form `method="GET"` o `router.push` desde cliente. Nada de estado local que se pierda al recargar.
- **Sanitización al guardar Y al renderizar.** Doble defensa: las server actions de productos/blog/pages/legal pasan por `sanitizeHtml()` antes de persistir; las páginas que renderizan HTML legacy también sanitizan. El editor WYSIWYG (Tiptap) produce HTML estructurado, pero **no** se confía en él — la sanitización server-side se aplica igual.
- **Idempotencia obligatoria en webhooks.** `WebhookEvent` con UNIQUE `(provider, event_id)` y P2002 ⇒ 200.
- **`router.refresh()` en lugar de `window.location.reload()`** tras cualquier server action. El `revalidatePath()` ya está dentro de las actions.
- **Server Components por defecto, Client Components por excepción.** Si un componente solo necesita leer, mejor SC. Cliente sólo cuando hay estado o eventos.
- **Tipos compartidos con `Prisma.GetPayload`.** Para queries con `include`/`select` complejos en el admin, usar `src/types/admin.ts` con `satisfies` — TS detecta regresiones cuando alguien cambia la query de la página.
- **Validación con Zod en bordes externos.** API routes y server actions que reciben payload del cliente. Endpoints que sólo el servidor invoca pueden saltarse Zod si el origen es confiable.
- **Rate limiting en endpoints sensibles.** Bucket por (IP, endpoint). Plesk single-process ⇒ memoria local OK; si se replica horizontal, sustituir `src/lib/rate-limit.ts` por Upstash manteniendo el contrato `{ ok, retryAfter, remaining }`.

### 7.2. Patrones a seguir

- **Server Action típica del admin:**
  ```ts
  'use server';
  export async function doSomething(formData: FormData) {
    try {
      await requireAdmin();          // o requireAdmin(['ADMIN']) para acciones sensibles
      const parsed = mySchema.safeParse(rawData);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
      // ... lógica con prisma.$transaction si toca múltiples tablas
      await auditLog({ action: 'entity.operation', entity_type: 'Entity', entity_id: id, metadata: {...} });
      revalidatePath('/[locale]/admin/...');
      return { success: true };
    } catch (e: any) {
      if (e instanceof AuthorizationError) return { success: false, error: e.message };
      return { success: false, error: 'Mensaje genérico — no filtrar stack' };
    }
  }
  ```
- **Cron endpoint típico:**
  ```ts
  export async function POST(req: Request) {
    try { verifyCronAuth(req); }
    catch (e) {
      if (e instanceof CronAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      throw e;
    }
    // ... batch limitado, idempotente, best-effort por elemento
    return NextResponse.json({ ok: true, processed, failures });
  }
  ```
- **Cambio de stock (admin o sistema):** siempre `productVariant.update({ stock: { increment/decrement } })` + `recordStockMovement({ variant_id, quantity ±, reason, reference_id, user_id })`. El log es opcional pero recomendado para reportes.
- **Manager cliente típico:** `useRouter()` de `@/i18n/navigation`, `await action(...)` + `closeModal()` + `router.refresh()`. Nada de `window.location.reload()`.
- **Página storefront con metadata + datos:** envolver el fetch principal en `cache()` de React para que `generateMetadata` y la página compartan el mismo round-trip a DB.

### 7.3. Anti-patrones a evitar

- ❌ Confiar en precios/cantidades enviados por el cliente.
- ❌ `findMany` sin paginación en admin con tablas que pueden crecer.
- ❌ `useEffect` con `setMounted(true)` para esquivar hidratación — preferir estado inicial coherente.
- ❌ `window.location.reload()`.
- ❌ `as any` masivo en componentes del admin — usar tipos de `src/types/admin.ts`.
- ❌ Scripts sueltos en raíz.
- ❌ `dangerouslySetInnerHTML` sin pasar antes por `sanitizeHtml`.
- ❌ Skip-link y `:focus-visible` ya están globales — no envolver botones con focus rings inline.
- ❌ Confiar en `file.name`/`file.type` del cliente al guardar un upload — validar magic bytes y generar el nombre en servidor (`src/lib/uploads.ts`).
- ❌ Añadir protección de rutas en middleware sin verificarla con una petición real sin sesión — un callback de NextAuth sin cablear (`authorized`) puede parecer una protección real y no ejecutarse nunca.
- ❌ Cambiar `next.config.ts`/`prisma/schema.prisma`/flags de CLI sin volver a arrancar el contenedor o correr el comando exacto que usa el entrypoint — un flag inválido con `set -e` tumba el arranque entero.

---

## 8. Historial de sprints (resumen)

| Sprint | Fecha | Foco | Ítems |
|---|---|---|---|
| 1 | 2026-05-01 | Seguridad bloqueante | #1 requireAdmin · #2 precios server-side · #3 stock atómico · #5 sanitización HTML · #6 cupones aplicados · #7 raíz limpia · #18 rate limiting · #21 order_number no enumerable |
| 2 | 2026-05-01 | Pagos reales | #27.a schema (PENDING_PAYMENT, payment_intent_id, invoice, tax_id, WebhookEvent) · #4 Stripe Checkout Sessions · #4.b webhook idempotente · #17 emails transaccionales |
| 3 | 2026-05-01 | Performance & SEO | #10 cache() + paralelización · #9 next/image masivo · #19 hreflang + canonical + JSON-LD (Breadcrumb, Article) + sitemap dinámico · #25 sin flag mounted en cart |
| 4 | 2026-05-01 | Conversión | #11 filtros + sort + autocomplete · #12 newsletter doble opt-in · #22 fusión carrito al login · #30 selectivo recently viewed |
| 5 | 2026-05-02 | Backoffice | #14 sin reload · #15 paginación admin · filtros + CSV pedidos · #13 dashboard real · #16 editor variantes · #23 tipos compartidos |
| Continuo | 2026-05-02 | Robustez | #8 middleware.ts · #20 Zod centralizado · #24 shortcodes AST · #27.b/c campos + AuditLog + StockMovement · #28 a11y básica |
| Dockerización | 2026-05-02 | Plantilla multi-instancia | Dockerfile multi-stage · docker-compose.yml · entrypoint con bootstrap (db push + seed) · `output:'standalone'` · `lib/stripe.ts` lee SiteSettings · `/api/health` · admin inicial autogenerado · documentación Portainer |
| Operativa | 2026-05-02 | Crones, audit, facturas | Cron `cleanup-pending-orders` (libera stock+cupón) · Cron `abandoned-carts` · `lib/audit.ts` cableado en 6 áreas del admin · `lib/stock.ts` cableado (PURCHASE/REFUND/RESTOCK/ADJUSTMENT/RESERVATION_RELEASE) · `lib/invoice.ts` + `lib/invoice-pdf.ts` (pdfkit) + endpoint `/api/admin/orders/[id]/invoice.pdf` · pestaña "Pagos (Stripe)" en `/admin/settings` |
| Compliance | 2026-05-02 | Fiscal/legal/RMA | **#19** Facturación correlativa estricta con `InvoiceCounter` UPSERT atómico (`<SERIE>-YYYY-NNNNNNN`) · **#20** Cookie consent banner RGPD con granularidad necessary/analytics/marketing + carga reactiva GA4/Meta Pixel · **#21** Flujo RMA completo (schema `Return`+`ReturnItem`, endpoint cliente con validación de elegibilidad, server actions admin con integración Stripe `refunds.create`, emails transaccionales por estado, `StockMovement(REFUND)` al recibir mercancía) |
| Escala UI | 2026-05-02 | Cursor + purga DaisyUI | **#26** `lib/pagination.ts` (cursor opaco base64url) + `<CursorPagination>` aplicado en `/admin/orders`, `/blog`, nueva `/admin/audit-logs` (sólo ADMIN, lookup users + filtros entity/action/IDs) · **#29** Auditoría reveló DaisyUI sólo en `stats` y `tabs`; ambas reescritas en CSS propio (~80 líneas) y purgada la dependencia (~70KB de bundle ahorrados) |
| Pre-producción | 2026-05-02 | Robustez | **#18** Restock condicional al recibir RMA (sólo `UNOPENED`/`OPENED` reabastecen stock; `DAMAGED`/`USED` no tocan stock — el descarte queda en `AuditLog` con métricas `restocked`/`discarded`) · **#35** Backup automatizado: side-car `backup` opcional en compose con `mariadb-dump`+gzip, cron configurable (`BACKUP_CRON`/`BACKUP_KEEP_DAYS`), volumen `db-backups` separado · **#38** 6 specs Playwright E2E: cookie consent, browse storefront, checkout COD end-to-end, login admin con guards, listado pedidos + export CSV, registro cliente + rate-limit. Scripts `npm run test:e2e[:ui|:debug]` |
| DX & Editorial | 2026-05-02 | CI + uploader + WYSIWYG | **#36** GitHub Actions con 4 jobs (`quality` typecheck+lint, `e2e` con MariaDB service + Playwright + bootstrap determinista, `docker-build` con cache GHA + smoke test, `docker-publish` a GHCR sólo en tags `vX.Y.Z`); concurrency cancela runs antiguos · **#18** `<ImageUploader>` cliente reutilizable con drag&drop, preview, reorder HTML5, delete reversible, paste desde portapapeles; sync con FormData vía DataTransfer; aplicado en ProductsManager (galería unificada, primera = principal), CategoriesManager (imagen única) y BlogManager (cover 16:9 — campo nuevo); server actions extendidas para procesar `images_order` (reorder + borrado físico) · **#1** `<RichTextEditor>` Tiptap con StarterKit + Link/Image/Placeholder/TextAlign; output HTML compatible con `sanitizeHtml` y shortcodes `{{category_id:slug}}`; `immediatelyRender:false` evita SSR mismatch; aplicado en ProductsManager (description), BlogManager (content), PagesManager y LegalManager (content) |
| Observabilidad | 2026-05-02 | Monitorización + retención + Stripe E2E + Sentry | **`/api/health`** ampliado con `uptimeSeconds` y `startedAt` · **nuevo `/api/health/deep`** que valida configuración (DB writeable, admin user, SMTP, Stripe, NEXTAUTH_SECRET, CRON_SECRET) y devuelve `status: ok\|warning\|critical` · **doc `monitoring.md`** con setup UptimeRobot/BetterStack/cron-job.org · **nuevo cron `/api/admin/cron/retention`** (diario): purga `WebhookEvent` >90d, `AuditLog` >365d, `StockMovement` >730d (ventanas configurables vía SiteSettings); `auditLogServer` registra el propio job para detectar volúmenes anómalos · **nuevo spec `07-stripe-webhook.spec.ts`**: helper de firma Stripe con HMAC SHA256 (sin SDK) que valida el contrato del webhook (firma faltante → 400, firma inválida → 400, event nuevo procesa, event repetido devuelve `duplicated:true` por `WebhookEvent` UNIQUE); CI inyecta `STRIPE_WEBHOOK_SECRET` y `E2E_STRIPE_WEBHOOK_SECRET` con valor de test · **integración Sentry opcional**: `src/lib/sentry.ts` con guard `isSentryEnabled()`; `src/instrumentation.ts` y `src/instrumentation-client.ts` inicializan SDK sólo si hay `SENTRY_DSN`; `captureError` cableado en webhook Stripe y catch genérico de checkout (excluye 409 de stock/cupón); `app/global-error.tsx` reporta crashes del cliente; doc `observability.md` con setup, tuning y filtros |
| Auditoría de seguridad | 2026-09-10 | Hardening + fixes validados con e2e real | **Crítico:** middleware sin protección real en `/admin/*` (código muerto) → `getToken()` + bloqueo real · path traversal / tipos arbitrarios en subida de imágenes → `lib/uploads.ts` (whitelist + magic bytes + nombre server-side) · `docker-entrypoint.sh`/CI usaban `prisma db push --skip-generate` (flag inexistente en Prisma 7.4.1) → **tumbaba el arranque de todo despliegue Docker**, corregido quitando el flag · **Pagos:** webhook revierte stock+cupón en pagos fallidos/expirados/cancelados (antes fuga permanente); reembolsos parciales ya no se tratan como totales; evita doble restitución de stock cuando el reembolso lo gestionó el flujo RMA · **RMA:** `refundReturn` reserva el estado antes de llamar a Stripe + `idempotencyKey` (evita doble reembolso); ventana de devolución sobre `delivered_at` en vez de `updated_at` · `sendEmail()` ya no finge éxito sin SMTP · paginación cursor reescrita como keyset real (`created_at`+`id`, antes asumía UUIDs ordenables) · checkout usa `checkoutSchema` de Zod en vez de validación manual · rate-limit en reviews/wishlist · timing-safe real en reset-password · mensajes de error específicos (P2003) al borrar productos/cupones con pedidos asociados · `localePrefix` corregido a `as-needed` (alineado con sitemap/hreflang/rewrite, que ya asumían "es sin prefijo") + ~30 enlaces admin con `/es/` hardcodeado limpiados · login redirige admins a `/admin` por rol · registro con atributos `name` en los inputs. Validado con `tsc --noEmit` limpio, `npm run build` y suite Playwright e2e completa (19 passed/1 skipped/0 failed) contra MariaDB real. Detalle completo en §9.9. |

**Pospuestos por tradeoff** (siguen abiertos en `ROADMAP.md`):

- **Combinatoria automática de variantes (matriz)** — el CRUD plano cubre el 80% de casos.

---

## 9. Notas históricas

### 9.1. Bug `pages_prefix = "null"` (literal)

El campo `pages_prefix` de `SiteSettings` puede llegar a la BD como string literal `"null"` cuando el form se deja vacío. Next.js lo interpreta literalmente, generando URLs `/es/null/PAGINA`. **Defensa documentada:** comparar con `prefix !== 'null'` además de `prefix !== ''` antes de usarlo. En `[...dynamicSlug]/page.tsx` puede haber un panel DEBUG en rojo para 404 — desactivar antes de producción.

### 9.2. `proxy.ts` → `middleware.ts`

Histórico: el archivo se llamaba `src/proxy.ts` por error. Next.js solo carga `src/middleware.ts` por convención exacta, así que aquel archivo nunca se ejecutaba. Renombrado en el bloque continuo (§8). El rewrite global de `next.config.ts` cubría parte del comportamiento, así que el sistema seguía funcionando.

### 9.3. Migración Plesk → Docker

El proyecto inicialmente se desplegaba en Plesk con Phusion Passenger (sin SSH, sin scheduler interno, build silencioso si fallaba). En 2026-05-02 se migró a una plantilla dockerizada (multi-stage build, `output: 'standalone'`, entrypoint que auto-aplica el schema y seed). La regla "raíz limpia" sigue vigente porque cualquier `.ts`/`.mjs` con errores rompe `next build` en el stage de Docker. Notas residuales de Plesk en commits/docs antiguas se mantienen sólo como referencia histórica.

### 9.4. Claves sensibles en `SiteSettings` (no env)

A partir del 2026-05-02 las claves de Stripe y SMTP **NO** son env vars de Docker — viven en `SiteSettings` y se editan desde `/admin/settings`. El cliente de Stripe (`src/lib/stripe.ts`) las lee con un cache TTL de 60 s. Las env vars siguen funcionando como fallback para CI/dev local. Esto permite que cada cliente despliegue la misma imagen base y configure su pasarela tras el primer login.

### 9.5. Crones, audit y facturas (bloque operativa 2026-05-02)

Tras dockerizar la plantilla, se cerraron las piezas operativas que faltaban para producción real:

- **Crones**: dos endpoints (`cleanup-pending-orders`, `abandoned-carts`) protegidos por `CRON_SECRET` con `timingSafeEqual`. El primero evita stock reservado infinito en órdenes Stripe abandonadas; el segundo recupera carritos abandonados sin necesidad de columna nueva en `cart_items` (ventana 24h-26h auto-idempotente).
- **AuditLog y StockMovement**: las tablas existían desde el bloque continuo pero estaban sin cablear. Ahora `auditLog()` se invoca en 6 áreas del admin (products/orders/users/settings/coupons/variants) y `recordStockMovement()` registra los 5 tipos de movimiento (`PURCHASE/REFUND/RESERVATION_RELEASE/RESTOCK/ADJUSTMENT`).
- **Facturas PDF**: numeración `INV-YYYY-XXXXXXXX` asignada lazy en webhook al confirmar pago. PDF generado on-the-fly con pdfkit en el endpoint de descarga (sin almacenamiento persistente). Datos del vendedor en `SiteSettings`.
- **Form Stripe**: pestaña "Pagos (Stripe)" en `/admin/settings` cierra el círculo del cambio del 9.4 — ya hay UI para introducir las claves en lugar de tocar env vars.

### 9.6. Compliance fiscal/legal y devoluciones (2026-05-02)

Bloque añadido para que la plantilla cumpla los mínimos legales antes del primer cliente real:

- **#19 Facturación correlativa estricta:** la numeración aleatoria del bloque 9.5 (`INV-YYYY-XXXXXXXX`) NO cumple el requisito fiscal AEAT/UE de correlación sin huecos. Se sustituyó por `InvoiceCounter` con UNIQUE `(series, year)` y UPSERT atómico → formato `<SERIE>-YYYY-NNNNNNN` (7 dígitos). El claim ocurre dentro de la misma transacción que confirma `PAID` para que ningún rollback consuma número. Serie configurable en `/admin/settings` con default `'A'`. Nota: para Veri*Factu (envío en tiempo real a la AEAT, obligatorio en España desde 2026 para parte del tejido empresarial) hace falta integrar con un servicio externo de facturación electrónica.
- **#20 Cookie consent banner (RGPD):** `<CookieConsent>` con granularidad `necessary/analytics/marketing` cumple la exigencia AEPD de "rechazar tan fácil como aceptar" (botón "Sólo necesarias" al mismo nivel que "Aceptar todo"). Persistencia en cookie 12 meses, con `version` para invalidar consents previos cuando cambies la política. `<AnalyticsScripts>` carga GA4/Meta Pixel sólo con consent y reactivamente vía evento custom `eshop:consent-changed`.
- **#21 Flujo RMA:** schema `Return`+`ReturnItem` con enums (REQUESTED/APPROVED/REJECTED/RECEIVED/REFUNDED/CANCELLED) y máquina de estados validada por `canTransition()`. Endpoint cliente `POST /api/storefront/returns` con validación de elegibilidad (DELIVERED + PAID + ventana `RETURN_WINDOW_DAYS`). UI cliente en `/account/orders/[id]/return` con form selectivo por item. UI admin `/admin/returns` con listado paginado + detalle con panel de acciones contextual al estado. Server actions `approveReturn`/`rejectReturn`/`markReturnReceived`/`refundReturn`. **`refundReturn` integra con Stripe `refunds.create`** cuando hay `payment_intent_id`, devolviendo el dinero al cliente vía API. `markReturnReceived` restituye stock con `productVariant.update(increment)` + `StockMovement(REFUND)`. Email transaccional en cada transición. `AuditLog` en cada paso.
  - **2026-09-10:** la ventana de devolución usaba `Order.updated_at` — se reiniciaba con cualquier edición posterior de la orden (tracking, notas...). Ahora usa `Order.delivered_at` (fijado sólo al entrar en `DELIVERED`), con fallback a `updated_at` sólo para órdenes ya `DELIVERED` antes de que el campo existiera.
  - **2026-09-10:** `refundReturn` llamaba a `stripe.refunds.create()` **antes** de reservar el estado (`Return.status`), permitiendo doble reembolso con doble clic/dos pestañas. Ahora la transición se reserva con `updateMany({where:{status:'RECEIVED'}})` (guard atómico) **antes** de llamar a Stripe, más `idempotencyKey` en la llamada; si Stripe rechaza, se deshace la reserva.

### 9.7. Escala UI: cursor pagination + purga DaisyUI (2026-05-02)

- **#26 Cursor pagination:** las tablas que crecen sin límite (`orders`, `audit_logs`, blog público) tienen ahora paginación cursor-based en lugar de offset+limit. El cursor es opaco para el cliente (base64url JSON `{id}`) y `findMany` usa `take: limit+1` para detectar `hasNext` sin segunda query. Tradeoff aceptado: no hay "ir a página 7" — sólo siguiente / volver al inicio. Aplicable cuando el listado es naturalmente cronológico y crece a escala (Prisma offset escanea linealmente las filas saltadas → quadrátic con N páginas). Helpers en `src/lib/pagination.ts` (`encodeCursor`/`decodeCursor`/`parseCursorParams`/`buildPrismaCursorArgs`/`buildCursorPage`). Componente `<CursorPagination>`. Aplicado en `/admin/orders`, `/blog` (público) y nueva `/admin/audit-logs` (sólo ADMIN, lookup de usuarios + filtros entity/action/UUIDs). Listados pequeños (categories/users/coupons/legal/pages/admin-blog) mantienen offset+25 porque su volumen no escala.

- **#29 Purga de DaisyUI:** auditoría con `grep` de uso real reveló que de las 100+ clases utility de DaisyUI sólo se consumían **dos primitivas** — `stats`/`stat`/`stat-*` (en el dashboard) y `tabs`/`tab`/`tab-content` (en el form de settings). Resto de clases que parecían DaisyUI (`btn-primary`, `card`, `modal`) son CSS propio definido en `globals.css` y `backoffice.css`. Sustituidas las dos primitivas por ~80 líneas en `globals.css` (`.stats { display: grid; ... }` y `.tab:checked + .tab-content { display: block }` para el patrón radio+content). DaisyUI desinstalado. Resultado: ~70KB de bundle ahorrados sin perder funcionalidad visual.

### 9.8. DX & Editorial: CI/CD + uploader + WYSIWYG (2026-05-02)

Tres piezas que cierran la experiencia de admin y la pipeline de release:

- **#36 CI/CD con GitHub Actions** — pipeline en `.github/workflows/ci.yml` con `quality` (typecheck + lint), `e2e` (services MariaDB + Playwright + bootstrap determinista con `ci-admin@example.com` / `CiTestPass123!`), `docker-build` (Buildx + cache GHA + smoke test) y `docker-publish` (push a `ghcr.io` sólo en tags `vX.Y.Z`). El `docker-build` no exige `e2e` como pre-requisito porque los tests pueden ser flaky en CI sin BD compartida; el typecheck sí bloquea. Cualquier developer ahora ve el estado del PR en el badge antes de merge.
- **#18 Drag & drop imágenes (`<ImageUploader>`)** — el patrón clave para integrar con FormData es **sync vía `DataTransfer`**: el componente mantiene un input file oculto y, en cada cambio del estado interno, regenera `input.files` con los archivos del usuario. Así `new FormData(form)` los recoge sin que el padre tenga que tocar nada. El orden y los deletes viajan en un input hidden con JSON serializado (`images_order`). Esto permitió **unificar** la galería de productos (antes había dos campos separados `main_image`/`gallery_images`) en un solo uploader donde la primera imagen es la principal — más simple para el editor y para la server action. Para imagen única (categorías, blog cover) se monta con `multiple={false}` y un `existingImages` sintético `[{id:'current', ...}]`; el server action interpreta `{id:'current', deleted:true}` como "borrar sin reemplazo".
- **#1 Editor WYSIWYG (Tiptap)** — la sanitización ya cubría XSS, así que el cambio es puramente UX. **Decisión clave: output HTML** (no JSON) para mantener compatibilidad con `sanitizeHtml` y con el procesado de shortcodes `{{category_id:slug}}` en `[...dynamicSlug]/page.tsx` y los managers, que asumen HTML. Tiptap preserva los shortcodes como texto plano dentro del HTML generado. **`immediatelyRender: false`** evita el SSR mismatch que tendría Tiptap por defecto en Next 16. Los managers (`Products/Blog/Pages/Legal`) pasan el HTML por `sanitizeHtml` server-side antes de persistir — el editor no es una fuente de confianza, sólo un input ergonómico.

### 9.9. Auditoría de seguridad en profundidad + validación real (2026-09-10)

Auditoría del código completo (4 agentes en paralelo, cada uno sobre una porción del sistema: pagos/stock, auth/seguridad, RMA/emails/crons, UI admin/schema) seguida de corrección de **todos** los hallazgos y validación contra un entorno real (Node 22 vía nvm — el proyecto necesita ≥22 para el CLI de Prisma 7.4.1, que en esta máquina de desarrollo corre en Node 20 por defecto —, MariaDB 10.11 en Docker, build de producción y la suite Playwright e2e completa). No se limitó a leer código: cada fix se probó contra una BD real antes de darlo por cerrado.

**Hallazgos críticos:**

- **Middleware sin protección real.** `src/middleware.ts` sólo ejecutaba `next-intl`; el callback `authorized` de NextAuth (que debía bloquear `/admin/*`) nunca se invocaba — quedó como código muerto desde que se escribió, probablemente por asumir erróneamente que `middleware.ts` lo usaba como wrapper de `auth()`. Resultado: cualquiera sin login que visitara `/admin/settings` veía `stripe_secret_key`, `stripe_webhook_secret` y credenciales SMTP en claro; `/admin/users` exponía PII de todos los clientes. Las *mutaciones* (server actions) sí estaban protegidas con `requireAdmin()` — sólo la lectura SSR estaba abierta. **Fix:** el middleware decodifica el JWT de sesión con `getToken()` de `next-auth/jwt` (deliberadamente sin pasar por `auth()`/`PrismaAdapter`, para no arrastrar el driver de MariaDB al bundle del middleware) y bloquea/redirige a login. El callback `authorized` muerto se eliminó de `src/lib/auth.ts` para no dejar la ilusión de una protección que no existía.
- **Subida de imágenes sin validar en servidor.** La extensión salía de `file.name.split('.').pop()` sin whitelist; la validación de tipo/tamaño sólo existía en el cliente (`ImageUploader.tsx`). Un archivo `.html`/`.svg` subido como "imagen de producto" quedaba servible como estático desde `/uploads/`, con riesgo de XSS almacenado. **Fix:** `src/lib/uploads.ts` nuevo — whitelist de MIME, verificación de magic bytes reales (el `file.type` del cliente no es de fiar), límite de tamaño server-side, nombre de archivo generado íntegramente en el servidor (nunca desde `file.name`). Aplicado en products/categories/blog/settings (logo, favicon, carrusel). De paso, `next.config.ts` ganó `experimental.serverActions.bodySizeLimit: '32mb'` — el default de Next (1MB) rompía cualquier subida por encima de eso pese a que el uploader promete hasta 8MB.
- **El arranque en Docker estaba roto.** `scripts/docker-entrypoint.sh` y el job `e2e` de CI invocaban `prisma db push --accept-data-loss=false --skip-generate`; `--skip-generate` no existe en el CLI de Prisma 7.4.1 (fijado en `package-lock.json`) y el comando fallaba con "unknown option". Con `set -e` activo en el entrypoint, esto **tumbaba el arranque del contenedor entero en todo despliegue Docker** — el método de despliegue documentado en este archivo llevaba tiempo sin funcionar. Fix: quitar el flag inexistente (verificado que `db push` sigue funcionando igual, sólo regenera el cliente en ~200-700ms extra).

**Pagos y RMA:**

- El webhook de Stripe dejaba la orden en `CANCELLED` sin revertir stock ni cupón ante pagos fallidos/expirados — y al quedar `CANCELLED`, quedaba fuera del alcance del cron `cleanup-pending-orders` (que sólo mira `PENDING_PAYMENT`) ⇒ fuga permanente. `payment_intent.canceled` compartía handler con `charge.refunded`, tratando un pago que nunca se cobró como un reembolso. Reembolsos parciales de Stripe se trataban como totales (restituía todo el stock, marcaba la orden entera `REFUNDED`). Cualquier reembolso vía el flujo RMA (`refundReturn`) hacía que el webhook **duplicara** la restitución de stock que `markReturnReceived` ya había hecho por ítem. Fix completo en §5.2.
- `refundReturn` llamaba a `stripe.refunds.create()` antes de reservar el estado de la devolución — doble clic o dos pestañas podían disparar dos reembolsos reales. Fix en §9.6.
- La ventana de devolución (`RETURN_WINDOW_DAYS`) se calculaba sobre `Order.updated_at`, que se pisa con cualquier edición posterior de la orden. Nuevo campo `Order.delivered_at`, fijado sólo al entrar en `DELIVERED`.

**Otros:**

- `sendEmail()` devolvía `{success:true}` aunque no hubiera SMTP configurado ("simulaba" el envío) — ahora devuelve `{success:false}` honesto y reporta a Sentry (si está activo), sin romper el contrato `nunca lanza` para los callers fire-and-forget.
- `src/lib/pagination.ts` paginaba por `orderBy:{id:'desc'}` asumiendo UUIDs ordenables — Prisma genera UUID v4 aleatorio, así que "página siguiente" no era realmente cronológico. Reescrito como keyset real sobre `(created_at, id)`, con `CURSOR_ORDER_BY` e índices nuevos en `Order.created_at`/`BlogPost.created_at`.
- El checkout reimplementaba a mano la validación que ya existía centralizada en `checkoutSchema` (Zod) — nunca se usaba.
- `reviews` y `wishlist` eran los únicos endpoints públicos sin rate-limit.
- `reset-password` comparaba firmas HMAC con `!==` (comentario decía "timing-safe", no lo era) — ahora usa `crypto.timingSafeEqual`.
- Borrar un producto/cupón con pedidos asociados lanzaba un P2003 crudo de Prisma sin explicar nada al admin (o, en el caso de `deleteProduct`, ni siquiera estaba en un try/catch) — ahora hay mensajes específicos y los managers cliente los muestran (antes ignoraban `error.message` y mostraban un texto fijo).
- `localePrefix: 'always'` en `src/i18n/navigation.ts` contradecía al resto del sistema (`next.config.ts` rewrite, `sitemap.ts`, hreflang de `layout.tsx`), que ya asumían "es sin prefijo, en con `/en/`" — con `'always'`, las URLs "canónicas" del sitemap en realidad redirigían (307). Corregido a `'as-needed'`. Efecto colateral: ~30 enlaces del panel admin (`AdminSidebar.tsx`, dashboard, listados) tenían `/es/` hardcodeado y habrían sufrido un redirect de más en cada navegación — limpiados (los `revalidatePath('/es/...')` NO se tocaron: operan sobre la ruta interna de Next, no la URL pública, y no les afecta este cambio).
- El login (`/auth/login`) redirigía siempre a `/account` tras autenticarse, ignorando el rol — un admin que entrara directo (sin rebote desde una página protegida) no llegaba a `/admin`. Ahora consulta la sesión con `getSession()` y redirige por rol.
- El formulario de registro (`/auth/register`) no tenía atributos `name` en los `<input>` (sólo `id`) — funcionaba en el navegador (React controla el estado por `value`/`onChange`), pero rompía autofill/tests. Añadidos.

**Metodología de verificación** (no sólo lectura de código): Node 22 vía `nvm`, contenedor MariaDB 10.11 efímero, `prisma db push` + `seed-bootstrap.mjs` con admin determinista, `npm run build` completo, y la suite Playwright e2e de principio a fin — que de paso reveló 4 bugs preexistentes sin relación con esta sesión (nunca antes detectados porque el job `e2e` de CI llevaba roto desde el fallo de `--skip-generate` descrito arriba): el test de `robots.txt` esperaba minúsculas donde Next.js emite mayúsculas (cosmético, se corrigió el test), y los otros 3 quedaron resueltos como parte de los fixes de arriba (login por rol, atributos `name` del registro). Resultado final: `tsc --noEmit` limpio, build sin errores, **19 passed / 1 skipped / 0 failed**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
