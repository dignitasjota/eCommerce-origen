# eCommerce — Plantilla dockerizada

Plataforma de eCommerce multi-idioma (es/en) con Next.js 16 App Router, MariaDB y Stripe. Incluye storefront pública y backoffice cerrado para gestión de catálogo, pedidos, blog y configuración.

**Plantilla pensada para multi-instancia.** Cada despliegue arranca con BD vacía y se autoconfigura: aplica el schema, crea un seed mínimo (categoría raíz, ajustes por defecto) y un admin inicial. Las claves sensibles (Stripe, SMTP, branding) se configuran desde el panel admin tras el primer login, **no como env vars**.

> Estado: **Sprints 1–5 + tareas continuas cerrados** (2026-05-02). Listo para producción.

## Documentación

- **[`CLAUDE.md`](./CLAUDE.md)** — contexto técnico completo: stack, estructura, modelo de datos, flujos críticos (checkout, webhook, carrito), filosofía y patrones.
- **[`ROADMAP.md`](./ROADMAP.md)** — qué se ha desarrollado, pendientes y backlog.
- **[`docs/deploy-portainer.md`](./docs/deploy-portainer.md)** — guía paso a paso de despliegue en VPS con Portainer (incluye DNS, reverse proxy, smoke test, mantenimiento).
- **[`docs/deploy-docker.md`](./docs/deploy-docker.md)** — guía rápida Docker / Portainer (alternativa más concisa).

## Stack

Next.js 16.1.6 · React 19 · TypeScript · Prisma 7 + MariaDB 10.11 · NextAuth v5 (beta) · next-intl · Stripe · Tailwind v4 + DaisyUI v5 · Zod · isomorphic-dompurify · pdfkit (facturas).

## Funcionalidades

- **Storefront i18n** (es/en) con SEO completo (hreflang, JSON-LD Breadcrumb/Article, sitemap dinámico, OG images).
- **Catálogo** con filtros, sort, autocomplete debounced y "vistos recientemente".
- **Checkout** con Stripe Checkout Sessions, COD y transferencia. Stock atómico, cupones con validación completa, fusión carrito anónimo↔login.
- **Stripe configurable desde el admin** (`SiteSettings`, sin tocar env vars en cada cliente). Webhook firmado e idempotente.
- **Backoffice completo:** dashboard analítico (KPIs, gráficos, top productos), CRUD paginado, editor de variantes con SKU/stock independientes, filtros y exportación CSV de pedidos.
- **Crones** de mantenimiento (`cleanup-pending-orders`, `abandoned-carts`) protegidos por `x-cron-secret`.
- **Factura PDF** automática al confirmar pago, descarga vía `/api/admin/orders/[id]/invoice.pdf`.
- **AuditLog** y **StockMovement** para trazabilidad de operaciones admin y movimientos de stock.
- **Newsletter** con doble opt-in, **wishlist**, **reseñas verificadas**.

## Despliegue rápido (Docker / Portainer)

```bash
# 1. Configurar variables (sólo las imprescindibles)
cp .env.docker.example .env
nano .env   # NEXTAUTH_URL, NEXTAUTH_SECRET, MYSQL_*, ADMIN_EMAIL

# 2. Build + arranque
docker compose up -d --build

# 3. Ver password del admin generada (sólo si no fijaste ADMIN_PASSWORD)
docker compose logs -f app
# Buscar "ADMIN INICIAL CREADO"

# 4. Configurar el resto desde el navegador
# https://tu-dominio/admin → login → /admin/settings (Stripe, SMTP, branding…)
```

Detalles paso a paso en [`docs/deploy-docker.md`](./docs/deploy-docker.md).

## Desarrollo local

```bash
# 1. Levantar sólo la BD con docker
docker compose up -d db

# 2. Variables de entorno locales
cp .env.docker.example .env
# Editar DATABASE_URL para apuntar a localhost:3306

# 3. Cliente Prisma + sincronizar schema
npx prisma generate
npx prisma db push

# 4. Dev server
npm run dev
```

App en `http://localhost:3000` (storefront) y `http://localhost:3000/admin` (backoffice).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor Next.js en desarrollo |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Servir el build de producción |
| `npm run lint` | ESLint |
| `npx prisma generate` | Regenerar cliente Prisma tras tocar el schema |
| `npx prisma db push` | Aplicar schema a la BD |
| `npx prisma studio` | GUI de la BD |
| `docker compose up -d` | Arrancar plantilla completa |
| `docker compose logs -f app` | Ver logs de la app (incluyendo password admin generada) |

## Estructura

```
.
├── Dockerfile                # Multi-stage build (deps → build → runner)
├── docker-compose.yml        # app + MariaDB + volúmenes persistentes
├── .env.docker.example       # Variables imprescindibles para deploy
├── prisma/
│   ├── schema.prisma         # Modelo completo
│   └── migrations-pending.sql# Snapshot del SQL acumulado (referencia)
├── scripts/
│   ├── docker-entrypoint.sh  # Bootstrap: wait DB → db push → seed → run
│   └── seed-bootstrap.mjs    # Seed mínimo idempotente
└── src/
    ├── app/
    │   ├── api/              # Endpoints (storefront, admin, webhooks, health)
    │   └── [locale]/
    │       ├── (storefront)/ # Tienda pública
    │       └── (backoffice)/admin/
    ├── components/           # Storefront + backoffice + shared
    ├── context/              # CartContext (fusión carrito al login)
    ├── i18n/                 # next-intl (es/en)
    ├── lib/                  # auth, db, stripe, coupons, sanitize, rate-limit, schemas...
    ├── styles/, themes/
    └── types/                # Prisma.GetPayload compartidos del admin
```

## Convenciones

Antes de contribuir, leer `CLAUDE.md` §7 (filosofía, patrones, anti-patrones). Reglas clave:

- **Servidor = fuente de verdad** de precios y stock.
- **Atomicidad obligatoria** con `updateMany` + guardia + transacción para invariantes críticas.
- **URL = fuente de verdad** para listados (filtros/sort/paginación en searchParams).
- Sanitizar HTML **al guardar y al renderizar**.
- `router.refresh()` en lugar de `window.location.reload()`.
- Server Components por defecto; Client Components por excepción.
- **Las claves sensibles van a `SiteSettings`**, no a env vars (excepto `DATABASE_URL` y `NEXTAUTH_SECRET`).
