# Checklist de deploy a producción (Plesk)

Lista paso a paso para llevar el proyecto a producción tras los Sprints 1–5 + tareas continuas. Marcar ✅ a medida que se completa.

> Antes de empezar: tener clones locales de **`.env`** apuntando a la BD remota de producción y al dashboard real de Stripe.

---

## 1️⃣ Migración Prisma a la BD de producción

**Riesgo:** medio. Los cambios son **aditivos** (nuevas tablas y columnas opcionales), pero `prisma db push` no genera migraciones versionadas; aplica los cambios directos.

### 1.1. Backup

⚠️ **OBLIGATORIO antes de tocar nada en producción**:

```bash
# Desde local, con mysqldump o el backup nativo de Plesk:
mysqldump -h HOST -u USER -p DB_NAME > backup-$(date +%Y%m%d-%H%M).sql
```

Plesk también ofrece backup/restore en su panel: **Bases de datos → Exportar**.

### 1.2. Verificar `.env`

```bash
# El DATABASE_URL del .env LOCAL debe apuntar a la BD de producción.
grep DATABASE_URL .env
```

### 1.3. Aplicar la migración

```bash
# Genera el cliente Prisma + sincroniza el schema con la BD.
# El flag --accept-data-loss=false aborta si Prisma detecta que perdería datos.
npx prisma db push --accept-data-loss=false
```

Lo que se va a aplicar (cambios respecto al schema previo a los Sprints):

**Tablas nuevas:**
- `webhook_events` — idempotencia de webhooks Stripe
- `subscribers` — newsletter con doble opt-in
- `audit_logs` — log de auditoría (cableado pendiente, tabla preparada)
- `stock_movements` — movimientos de stock (cableado pendiente, tabla preparada)

**Columnas nuevas:**
- `users.is_active` (boolean, default true)
- `users.last_login_at` (datetime, nullable)
- `addresses.tax_id` (varchar(32), nullable) — NIF/CIF
- `products.weight` (decimal 8,3, nullable)
- `products.dimensions` (varchar(100), nullable) — JSON `{w,h,d}`
- `products.barcode` (varchar(50), nullable)
- `reviews.images` (text, nullable) — JSON array de URLs
- `reviews.is_verified_purchase` (boolean, default false)
- `orders.payment_intent_id` (varchar(255), UNIQUE, nullable) — Stripe
- `orders.invoice_number` (varchar(50), UNIQUE, nullable)
- `orders.invoice_url` (varchar(500), nullable)
- `orders.fulfillment_status` (enum, default `UNFULFILLED`)

**Enums:**
- `OrderStatus` — añadido valor `PENDING_PAYMENT` al inicio
- `FulfillmentStatus` (nuevo) — `UNFULFILLED|PICKING|PACKED|SHIPPED|DELIVERED|RETURNED`
- `StockMovementReason` (nuevo) — `PURCHASE|REFUND|ADJUSTMENT|RESTOCK|RESERVATION_RELEASE`

### 1.4. Verificar con Prisma Studio

```bash
npx prisma studio
```

Abrir el navegador y comprobar que las nuevas tablas existen y los `Order` actuales tienen `fulfillment_status='UNFULFILLED'` por defecto.

- [ ] Backup creado
- [ ] `prisma db push` ejecutado sin errores
- [ ] Verificación visual con Prisma Studio

---

## 2️⃣ Variables de entorno en Plesk

En el panel de Plesk → **Node.js → Variables de entorno** (o equivalente del panel):

```
DATABASE_URL=mysql://USER:PASS@HOST:3306/DB_NAME
NEXTAUTH_URL=https://tudominio.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=<RELLENAR EN PASO 3>

NEXT_PUBLIC_APP_URL=https://tudominio.com

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM="\"eShop\" <no-reply@tudominio.com>"
```

> ℹ️ `NEXT_PUBLIC_APP_URL` debe coincidir con `NEXTAUTH_URL`. La duplicación es a propósito: la primera se incrusta en el cliente (sitemap, canonical, og:url), la segunda solo en server.

⚠️ Si las variables de Stripe ya estaban como **test** (`sk_test_…`/`whsec_…` de test), sustituirlas por las de **live**.

- [ ] `DATABASE_URL` correcta
- [ ] `NEXTAUTH_URL` y `NEXT_PUBLIC_APP_URL` apuntan al dominio real
- [ ] `NEXTAUTH_SECRET` regenerado (no reutilizar el de dev)
- [ ] Variables Stripe en **live mode**
- [ ] SMTP funcional

---

## 3️⃣ Webhook de Stripe

### 3.1. Crear endpoint

1. Entrar en el dashboard de Stripe (modo **live**, no test).
2. **Developers → Webhooks → Add endpoint**.
3. **Endpoint URL:** `https://tudominio.com/api/webhooks/stripe`
4. **Listen to:** Events on your account.
5. **Select events:**
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `payment_intent.canceled`
6. Guardar.

### 3.2. Copiar el signing secret

Tras crearlo, en la página del endpoint hay un campo **Signing secret** (`whsec_…`). **Copiarlo** y ponerlo como `STRIPE_WEBHOOK_SECRET` en Plesk. Reiniciar app.

### 3.3. Probar con un evento de prueba

En el dashboard, en la página del endpoint: **Send test webhook → checkout.session.completed**. Debe responder `200 OK`. Si devuelve `400 "Firma inválida"`, el secret no coincide.

- [ ] Endpoint creado
- [ ] Eventos seleccionados (los 6)
- [ ] `STRIPE_WEBHOOK_SECRET` configurado en Plesk
- [ ] Test webhook → 200 OK

---

## 4️⃣ Build en Plesk

1. **Run Script: build** en el panel Node.js de Plesk.
   - Ejecuta `npx prisma generate && next build`.
   - **Esperar** a que termine y revisar logs (Plesk silencia errores de build sirviendo caché vieja — bug histórico).
2. **Restart App**.
3. Comprobar que la home carga: `curl -I https://tudominio.com` → debe ser 200/308.
4. **Smoke test manual:**
   - Abrir `https://tudominio.com` en navegador (storefront).
   - Login en `https://tudominio.com/admin` con un usuario `ADMIN`.
   - Crear un pedido de test:
     - Añadir un producto al carrito.
     - Ir a checkout.
     - Pagar con tarjeta test `4242 4242 4242 4242`, fecha futura, CVC `123`, ZIP `00000`.
     - El pedido debe llegar al admin como `PAID + CONFIRMED`.
     - El email de confirmación debe llegar a la dirección usada.

- [ ] Build OK (revisar logs)
- [ ] Restart App OK
- [ ] Home responde 200
- [ ] Admin login OK
- [ ] Pedido test 4242 → `PAID + CONFIRMED`
- [ ] Email de confirmación recibido

---

## 5️⃣ Verificaciones post-deploy

### 5.1. Métricas SEO/Performance

Tras 1-2 días que Google rastree:

- **Lighthouse** (Chrome DevTools → Lighthouse) en home y producto:
  - Performance ≥ 85
  - SEO ≥ 95
  - Accessibility ≥ 90
- **PageSpeed Insights:** mismo dominio, comparar mobile/desktop.
- **Search Console:** subir `sitemap.xml` (`https://tudominio.com/sitemap.xml`) si no estaba.

### 5.2. Funcionalidades clave

- [ ] **Newsletter:** suscribirse desde la home, recibir email de doble opt-in, hacer click → mensaje "Suscripción confirmada".
- [ ] **Carrito anónimo + login:** añadir items sin sesión, hacer login, verificar que se fusionan en el carrito del usuario.
- [ ] **Cupón:** probar con un cupón válido (descuento aparece en el resumen).
- [ ] **Filtros + autocomplete** en `/products`.
- [ ] **Wishlist** (si feature flag activado).
- [ ] **Stripe refund:** desde dashboard, refundir el pedido test → debe llegar email "Pedido reembolsado".

---

## 6️⃣ Pendientes posteriores (no bloquean deploy)

Estos puntos pueden hacerse en sprints posteriores sin parar la tienda:

1. **Cron de `PENDING_PAYMENT` vencidos** (>30 min): liberar stock + decrementar `coupon.used_count` + marcar `CANCELLED`. Crear endpoint admin `/api/admin/cron/cleanup-pending-orders` con header secret y llamarlo desde cron-job.org cada 5 min.
2. **Cron de carrito abandonado.**
3. **Cableado de `AuditLog`** desde server actions del admin.
4. **Cableado de `StockMovement`** en checkout/refund/editor variantes.
5. **Generación de factura PDF** al cobrar (rellenar `invoice_number`/`invoice_url`).

Detalles en `ROADMAP.md`.
