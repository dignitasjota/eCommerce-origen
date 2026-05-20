# Guía de despliegue en VPS con Portainer

Procedimiento paso a paso para desplegar una nueva tienda partiendo de la plantilla. Asume que el VPS ya tiene **Portainer instalado y accesible**, y que tienes acceso de administrador.

> **Tiempo estimado total:** 30-45 minutos (la mayor parte es esperar al DNS).

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Preparación de la imagen](#2-preparación-de-la-imagen)
3. [Configuración del DNS](#3-configuración-del-dns)
4. [Reverse proxy con HTTPS](#4-reverse-proxy-con-https)
5. [Crear el stack en Portainer](#5-crear-el-stack-en-portainer)
6. [Primer arranque y login admin](#6-primer-arranque-y-login-admin)
7. [Configuración post-deploy desde el admin](#7-configuración-post-deploy-desde-el-admin)
8. [Configurar Stripe](#8-configurar-stripe)
9. [Smoke test](#9-smoke-test)
10. [Mantenimiento](#10-mantenimiento)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Pre-requisitos

### 1.1. En el VPS

Antes de empezar, verifica que tienes lo siguiente. Si falta algo, instálalo desde la consola del VPS (SSH).

| Componente | Cómo verificar | Si falta |
|---|---|---|
| Docker Engine ≥ 20.10 | `docker --version` | Viene con Portainer en la instalación oficial. Si no: `curl -fsSL https://get.docker.com \| sh`. |
| Docker Compose plugin | `docker compose version` | `apt install docker-compose-plugin` |
| Portainer Community/BE | Acceso web (suele ser `:9443` o `:9000`) | Documentación: https://docs.portainer.io |
| Reverse proxy (Traefik / NPM / Caddy) | Ya gestiona HTTPS | Ver [§4](#4-reverse-proxy-con-https) |
| Acceso al panel de DNS de tu dominio | — | — |
| Acceso shell al VPS (SSH) | `ssh user@vps-ip` | — |

### 1.2. En tu máquina local

- **Git** para clonar la plantilla (o tener acceso al registry donde subiste la imagen).
- Editor de texto y permisos de lectura del proyecto.

### 1.3. Información del cliente

Recopila estos datos antes de empezar — los necesitarás:

- [ ] Nombre del dominio elegido (ej. `tienda.cliente.com` o `cliente.com`).
- [ ] Si tendrá cuenta de Stripe propia (la mayoría sí) — pedir acceso o que la creen.
- [ ] Datos SMTP del cliente para emails transaccionales (host, puerto, user, pass, dirección de envío).
- [ ] Logos, paleta de colores, textos legales (RGPD/cookies/términos) — opcional al inicio, pero los necesitará pronto.

---

## 2. Preparación de la imagen

Hay dos rutas: **construir en el VPS** (más simple, recomendado para empezar) o **construir en tu máquina y subir a un registry** (mejor para múltiples instancias).

### 2.1. Ruta A — Construir en el VPS (recomendado para 1-3 tiendas)

```bash
# SSH al VPS
ssh user@vps-ip

# Crear carpeta para esta instancia (una por cliente)
sudo mkdir -p /opt/ecommerce-clientex
sudo chown $USER:$USER /opt/ecommerce-clientex
cd /opt/ecommerce-clientex

# Clonar la plantilla (por HTTPS o SSH)
git clone https://github.com/tu-usuario/ecommerce-template.git .
# o si la plantilla es privada con deploy key:
# git clone git@github.com:tu-usuario/ecommerce-template.git .
```

### 2.2. Ruta B — Imagen pre-construida en registry

> Para esto necesitas haber publicado la imagen previamente con `docker buildx build --push -t registry.tudominio.com/ecommerce:1.0.0 .`.

```bash
ssh user@vps-ip
sudo mkdir -p /opt/ecommerce-clientex && cd /opt/ecommerce-clientex

# Sólo necesitas docker-compose.yml y .env
curl -O https://raw.githubusercontent.com/tu-usuario/ecommerce-template/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/tu-usuario/ecommerce-template/main/.env.docker.example
```

Y editar `docker-compose.yml` para que la sección `app` use la imagen del registry en lugar de `build:`:

```yaml
  app:
    image: registry.tudominio.com/ecommerce:1.0.0   # en lugar de build:
    container_name: ecommerce-app
    # … resto igual
```

---

## 3. Configuración del DNS

En el panel DNS de tu dominio (Cloudflare, Namecheap, OVH…):

1. Crear un registro **A** apuntando al **IP público del VPS**:
   - **Tipo:** A
   - **Nombre:** `tienda` (o `@` si va en la raíz)
   - **Valor:** `XX.XX.XX.XX` (IP del VPS)
   - **TTL:** Auto / 300

2. Esperar propagación (5-30 min según proveedor). Verificar:
   ```bash
   dig +short tienda.cliente.com
   # Debe devolver la IP del VPS
   ```

> ⚠️ Hasta que el DNS resuelva, el reverse proxy no podrá emitir el certificado HTTPS.

---

## 4. Reverse proxy con HTTPS

La aplicación escucha **HTTP en el puerto 3000** dentro del contenedor. **No incluye TLS** — confía en un reverse proxy externo. Aquí tres opciones según lo que ya tengas.

### Opción A — Nginx Proxy Manager (recomendado, GUI)

Si ya tienes NPM instalado en el VPS:

1. Ir a la GUI (típicamente `http://vps-ip:81`).
2. **Hosts → Proxy Hosts → Add Proxy Host**.
3. Configurar:
   - **Domain Names:** `tienda.cliente.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `ecommerce-app` (el nombre del contenedor) o `XX.XX.XX.XX` si NPM corre fuera de la red docker.
   - **Forward Port:** `3000`
   - **Block Common Exploits:** ON
   - **Websockets Support:** ON
4. Pestaña **SSL**:
   - **SSL Certificate:** Request a new SSL Certificate (Let's Encrypt).
   - **Force SSL:** ON
   - **HTTP/2 Support:** ON
   - Email de contacto.
5. **Save**.

> Si NPM corre en otra red docker, hay que conectar la red del proyecto a NPM:
> ```bash
> docker network connect ecommerce_ecommerce-net nginx-proxy-manager_default
> ```

### Opción B — Traefik

Si usas Traefik con descubrimiento por labels, añade al servicio `app` en `docker-compose.yml`:

```yaml
  app:
    # … resto …
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tienda.rule=Host(`tienda.cliente.com`)"
      - "traefik.http.routers.tienda.entrypoints=websecure"
      - "traefik.http.routers.tienda.tls.certresolver=letsencrypt"
      - "traefik.http.services.tienda.loadbalancer.server.port=3000"
    networks:
      - ecommerce-net
      - traefik-public   # red externa de Traefik

networks:
  traefik-public:
    external: true
```

Y elimina la línea `ports:` del servicio `app` (Traefik lo resuelve internamente).

### Opción C — Caddy

```caddyfile
tienda.cliente.com {
    reverse_proxy ecommerce-app:3000
    encode gzip zstd
}
```

Caddy gestiona los certificados automáticamente.

---

## 5. Crear el stack en Portainer

### 5.1. Generar los secretos

En tu máquina local o el VPS:

```bash
# NEXTAUTH_SECRET — clave para firmar JWTs (32 bytes en base64)
openssl rand -base64 32
# → ejemplo: aB3xK9...   COPIAR

# Passwords MySQL (root y user)
openssl rand -base64 24
# → ejemplo: pQ8R2u...   COPIAR (una para cada)
```

### 5.2. Subir el código a Portainer

#### Si construiste en el VPS (ruta A):

1. Portainer → **Stacks → Add stack**.
2. **Name:** `ecommerce-clientex`
3. **Build method:** seleccionar **Repository**.
4. **Repository URL:** la URL del repo Git (HTTPS o SSH).
5. **Repository reference:** `refs/heads/main` (o la rama que uses).
6. **Compose path:** `docker-compose.yml`
7. **Authentication:** si el repo es privado, añadir credenciales.

#### Si usas imagen del registry (ruta B):

1. Portainer → **Stacks → Add stack**.
2. **Name:** `ecommerce-clientex`
3. **Build method:** **Web editor**.
4. Pegar el contenido de `docker-compose.yml` (modificado para usar `image:` en lugar de `build:`).

### 5.3. Variables de entorno en Portainer

En la sección **Environment variables** del stack, añadir:

| Variable | Valor | Notas |
|---|---|---|
| `NEXTAUTH_URL` | `https://tienda.cliente.com` | Dominio público con HTTPS, sin barra final. |
| `NEXTAUTH_SECRET` | `<el openssl rand del paso 5.1>` | NO reutilizar entre tiendas. |
| `MYSQL_DATABASE` | `ecommerce` | Cambiar si quieres aislar nombres. |
| `MYSQL_USER` | `ecommerce` | — |
| `MYSQL_PASSWORD` | `<password seguro>` | El que generaste con openssl. |
| `MYSQL_ROOT_PASSWORD` | `<password seguro>` | Distinto al anterior. |
| `ADMIN_EMAIL` | `admin@cliente.com` | Email del primer admin. |
| `ADMIN_PASSWORD` | (vacío) | Si lo dejas vacío, se autogenera y aparece en logs. |
| `CRON_SECRET` | `<openssl rand -hex 32>` | Sin él, los crones se rechazan (fail-safe). Ver [§Configurar crones](#82-configurar-crones). |
| `APP_PORT` | `3000` | Sólo si NO usas reverse proxy y quieres exponer al host. Si usas proxy, déjalo y simplemente el proxy llama al puerto interno. |

> 💡 **Buena práctica:** marca como "advanced mode" en Portainer y guarda el bloque entero como una variable JSON copiable, así te ahorras teclear todo cuando despliegues otra tienda.

### 5.4. Lanzar el stack

1. Click en **Deploy the stack**.
2. Portainer comenzará a construir la imagen (5-8 min la primera vez si es ruta A).
3. Cuando termine, los dos contenedores (`ecommerce-app`, `ecommerce-db`) deben aparecer en estado **running**.

---

## 6. Primer arranque y login admin

### 6.1. Ver los logs

En Portainer: **Containers → ecommerce-app → Logs**. Esperar 30-60 segundos hasta ver:

```
⏳ Esperando a la base de datos...
✅ Base de datos accesible.
📦 Sincronizando schema (prisma db push)...
🌱 Ejecutando seed inicial (idempotente):
  · 10 ajustes verificados
  · categoría raíz "general" creada
  ─────────────────────────────────────────────
  · ADMIN INICIAL CREADO
    email:    admin@cliente.com
    password: changeme-aB3xK9pQ
    ⚠️  CAMBIA LA CONTRASEÑA EN EL PRIMER LOGIN.
  ─────────────────────────────────────────────
✅ Seed completado.
🚀 Lanzando servidor...
   ▲ Next.js 16.1.6
   - Local:   http://0.0.0.0:3000
 ✓ Ready in ...
```

**Apuntar la password generada** — sólo aparece UNA VEZ en los logs.

### 6.2. Verificar healthcheck

```bash
# Desde el VPS:
docker exec ecommerce-app wget -qO- http://localhost:3000/api/health
# Debe responder: {"status":"ok","db":"up"}
```

O directamente desde tu navegador: `https://tienda.cliente.com/api/health`.

### 6.3. Primer login

1. Abrir `https://tienda.cliente.com/admin/login` (o `/auth/login` según routing).
2. Email + password del log.
3. **Cambiar la password inmediatamente** desde tu perfil de admin.

---

## 7. Configuración post-deploy desde el admin

Configurar la tienda navegando a las distintas secciones del admin. Todo se persiste en `SiteSettings` de la BD.

### 7.1. Ajustes generales (`/admin/settings`)

- **Branding:** `site_name`, `site_logo` (subir), `site_favicon` (subir).
- **SEO defaults:** `seo_default_title`, `seo_default_description`, `seo_twitter_handle`.
- **i18n:** `currency` (EUR/USD/…).
- **Tema:** `storefront_theme` (default / elegant-dark / eco-nature / vibrant-tech / pastel-breeze) o subir un `.css` propio.
- **Páginas dinámicas:** `pages_prefix` (vacío = páginas en raíz, ej. `page` = bajo `/page/...`).
- **Hero carousel:** subir imágenes, ajustar `home_carousel_interval` (ms).
- **Feature flags:** `feature_blog_enabled`, `feature_wishlist_enabled`, `feature_contact_enabled`.

### 7.2. SMTP (en el mismo `/admin/settings`)

- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`.
- Probar enviando un email de prueba (registro de usuario nuevo, por ejemplo).

### 7.3. Métodos de envío (`/admin/shipping`)

Crear al menos uno (ej. "Estándar 24-48h", precio 4.99 €, gratis a partir de 50 €).

### 7.4. Métodos de pago (`/admin/payments`)

Habilitar los métodos que aceptará la tienda:

- **Tarjeta (Stripe)** — requiere claves del paso 8.
- **Transferencia bancaria.**
- **Contrareembolso.**

### 7.5. Categorías y productos (`/admin/categories`, `/admin/products`)

Crear estructura de catálogo. Si vas a importar muchos productos, considera escribir un seed específico por cliente en lugar de meterlos a mano.

### 7.6. Páginas legales (`/admin/legal`) — obligatorio en UE

Subir como mínimo:

- Aviso legal.
- Política de privacidad.
- Política de cookies.
- Términos y condiciones de venta.
- Política de devoluciones.

---

## 8. Configurar Stripe

### 8.1. Obtener las claves

1. Crear cuenta en https://dashboard.stripe.com (o usar la del cliente).
2. Activar el modo **live** (esquina superior derecha) cuando esté listo. Para pruebas, dejar en **test**.
3. **Developers → API keys** → copiar:
   - **Secret key:** `sk_live_…` (o `sk_test_…`).
   - **Publishable key:** `pk_live_…` (opcional, para Elements futuros).

### 8.2. Pegar las claves en el admin

En `/admin/settings` (o `/admin/payments` según donde se haya cableado el form):

- `stripe_secret_key` = `sk_live_…`
- `stripe_publishable_key` = `pk_live_…`

> El cache TTL del cliente Stripe es 60 s. Si quieres que aplique al instante, reinicia el contenedor `app` desde Portainer.

### 8.3. Crear el webhook

1. **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL:** `https://tienda.cliente.com/api/webhooks/stripe`
3. **Listen to:** Events on your account.
4. **Select events** (los 6 que la app maneja):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `payment_intent.canceled`
5. Guardar.
6. En la página del endpoint, copiar el **Signing secret** (`whsec_…`).
7. Pegar en `/admin/settings` como `stripe_webhook_secret`.

### 8.4. Probar el webhook

En la página del endpoint en Stripe: **Send test webhook → checkout.session.completed**. Debe responder **200**. Si responde **400 "Firma inválida"**, el secret no coincide. Si responde **500 "Webhook no configurado"**, no se ha guardado el `stripe_webhook_secret` en SiteSettings.

---

## 8.2. Configurar crones

La plantilla expone 2 endpoints `POST /api/admin/cron/*` que **no se ejecutan solos**. Hay que dispararlos desde fuera con la cabecera `x-cron-secret: $CRON_SECRET`.

### Cron 1: limpieza de pedidos `PENDING_PAYMENT` vencidos

`POST /api/admin/cron/cleanup-pending-orders` — frecuencia recomendada: **cada 5 minutos**. Libera stock + cupón y marca CANCELLED órdenes Stripe abandonadas hace > 30 min.

### Cron 2: emails de carrito abandonado

`POST /api/admin/cron/abandoned-carts` — frecuencia recomendada: **cada 1 hora**. Envía email a usuarios con cart_items en ventana 24h-26h sin orden reciente.

### Opción A — cron-job.org (gratis, sin tocar el VPS)

1. Crear cuenta en https://cron-job.org.
2. **Add cronjob:**
   - **URL:** `https://tienda.cliente.com/api/admin/cron/cleanup-pending-orders`
   - **Schedule:** every 5 minutes.
   - **Advanced → Request method:** `POST`.
   - **Advanced → Headers:** añadir `x-cron-secret` con valor `$CRON_SECRET`.
3. Repetir para `abandoned-carts` con schedule cada hora.
4. **Verificar** en el log de cron-job.org que los jobs devuelven `200 {"ok":true,...}`.

### Opción B — side-car en `docker-compose.yml`

Si prefieres que los crones vivan dentro del propio stack y no dependan de un servicio externo:

```yaml
  # Añadir al final de `services:` en docker-compose.yml
  cron:
    image: alpine:3.19
    container_name: ecommerce-cron
    restart: unless-stopped
    depends_on: [app]
    environment:
      CRON_SECRET: "${CRON_SECRET}"
    command: >
      sh -c "
      apk add --no-cache curl &&
      printf '*/5 * * * * curl -fsS -X POST -H \"x-cron-secret: %s\" http://app:3000/api/admin/cron/cleanup-pending-orders > /proc/1/fd/1 2>&1\n0 * * * *   curl -fsS -X POST -H \"x-cron-secret: %s\" http://app:3000/api/admin/cron/abandoned-carts > /proc/1/fd/1 2>&1\n' \"$$CRON_SECRET\" \"$$CRON_SECRET\" > /etc/crontabs/root &&
      crond -f -L /dev/stdout
      "
    networks: [ecommerce-net]
```

Tras añadirlo, **Stacks → Update** en Portainer para que aplique.

### Verificación manual

```bash
# Desde el VPS (debería responder 200 OK con un resumen JSON):
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
     https://tienda.cliente.com/api/admin/cron/cleanup-pending-orders
```

Si responde **401 Unauthorized**, el secret no coincide. Si responde **500**, falta `CRON_SECRET` en el entorno del contenedor `app`.

---

## 9. Smoke test

Antes de dar la tienda por desplegada, ejecuta este checklist desde un navegador anónimo:

- [ ] **Home pública** carga sin errores y muestra logo + nombre.
- [ ] **Listado de productos** funciona, filtros aplicables.
- [ ] **Buscador del header** con autocomplete responde.
- [ ] **Ficha de producto** abre, gallery funciona, breadcrumbs OK.
- [ ] **Añadir al carrito** funciona, badge se actualiza.
- [ ] **Cart drawer** abre desde el header.
- [ ] **Checkout completo con tarjeta de prueba**:
  - Tarjeta: `4242 4242 4242 4242`
  - CVC: `123`
  - Fecha: cualquier futura
  - ZIP: `00000`
  - El checkout redirige a Stripe → vuelve a `/checkout/success/<orderId>` → email de confirmación llega.
- [ ] **Admin → /admin/orders** muestra el pedido como `PAID + CONFIRMED`.
- [ ] **Newsletter:** suscribirse desde el home → email de doble opt-in llega → al hacer click se confirma.
- [ ] **Refund desde Stripe dashboard:** refundir el pedido test → email "Pedido reembolsado" llega + stock se restituye.
- [ ] **Factura PDF:** desde `/admin/orders/<id>` o el endpoint `/api/admin/orders/<id>/invoice.pdf` → descarga un PDF con número `INV-YYYY-XXXXXXXX` y datos del vendedor configurados en `/admin/settings`.
- [ ] **Crones:** verificar manualmente con `curl -X POST -H "x-cron-secret: $CRON_SECRET" /api/admin/cron/cleanup-pending-orders` → responde 200 con resumen JSON.
- [ ] **Mobile:** abrir en móvil real, verificar que es usable.
- [ ] **Lighthouse** (DevTools → Lighthouse) en home: Performance ≥ 80, SEO ≥ 95, A11y ≥ 90.

---

## 10. Mantenimiento

### 10.1. Actualizar a una versión nueva de la plantilla

```bash
# Desde el VPS (si construiste con ruta A)
cd /opt/ecommerce-clientex
git pull origin main
docker compose build app
docker compose up -d app
```

O desde Portainer: **Stacks → ecommerce-clientex → Pull and redeploy**.

El entrypoint aplica las migraciones automáticamente. Si los cambios son aditivos (lo normal), no hay downtime de datos.

### 10.2. Backup de la BD

```bash
# Manual:
docker compose exec db mariadb-dump \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  ecommerce > backup-$(date +%Y%m%d-%H%M).sql

# Comprimido:
docker compose exec db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce | gzip > backup.sql.gz
```

**Backup automatizado** — añadir un cron al host:

```bash
# /etc/cron.d/ecommerce-backup
0 3 * * * root cd /opt/ecommerce-clientex && docker compose exec -T db mariadb-dump -u root -p"$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2)" ecommerce | gzip > /var/backups/ecommerce/db-$(date +\%Y\%m\%d).sql.gz && find /var/backups/ecommerce -name 'db-*.sql.gz' -mtime +30 -delete
```

> ⚠️ Tampién hacer backup del volumen `uploads` (imágenes subidas):
> ```bash
> docker run --rm -v ecommerce_uploads:/data -v $PWD:/backup alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz /data
> ```

### 10.3. Restaurar backup

```bash
# Stop app para evitar escrituras concurrentes
docker compose stop app

# Restaurar BD
docker compose exec -T db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce < backup.sql

# Restaurar uploads
docker run --rm -v ecommerce_uploads:/data -v $PWD:/backup alpine \
  tar xzf /backup/uploads-YYYYMMDD.tar.gz -C /

# Volver a arrancar
docker compose start app
```

### 10.4. Resetear admin (olvido de password)

```bash
docker compose exec db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce \
  -e "DELETE FROM users WHERE role='ADMIN';"
docker compose restart app
# El bootstrap creará un admin nuevo y lo imprimirá en logs
docker compose logs -f app | grep "ADMIN INICIAL"
```

### 10.5. Cambiar el dominio

```bash
# 1. Actualizar DNS al nuevo dominio
# 2. Editar .env (o variables del stack en Portainer):
NEXTAUTH_URL=https://nuevo-dominio.com

# 3. Aplicar
docker compose up -d --no-deps app

# 4. Actualizar el reverse proxy con el nuevo dominio
# 5. Actualizar la URL del webhook en Stripe dashboard
```

> ⚠️ Cambiar `NEXTAUTH_URL` invalida todas las sesiones existentes (los JWTs apuntaban al issuer anterior). Los usuarios tendrán que volver a loguearse.

---

## 11. Troubleshooting

### 11.1. El contenedor `app` no arranca

Ver logs:
```bash
docker compose logs --tail=50 app
```

**Causas comunes:**

| Síntoma | Causa | Solución |
|---|---|---|
| `DATABASE_URL no está configurada. Abortando.` | Falta env var | Revisar variables del stack en Portainer. |
| `Base de datos no disponible tras 30 intentos` | El servicio `db` no responde | `docker compose ps` → ver si `db` está unhealthy → ver `docker compose logs db`. |
| `ERR_PRISMA_*` | Schema corrupto | Restaurar backup y revisar. |
| `Error: Cannot find module '@prisma/client'` | Build mal | Reconstruir: `docker compose build --no-cache app`. |

### 11.2. La tienda devuelve 502 Bad Gateway

El reverse proxy no encuentra la app:

1. **Verificar que el contenedor `app` está running:**
   ```bash
   docker compose ps
   docker compose logs --tail=20 app
   ```
2. **Verificar healthcheck:**
   ```bash
   docker compose exec app wget -qO- http://localhost:3000/api/health
   ```
3. **Si usas Traefik/NPM:** ¿el contenedor está en la misma red docker que el proxy? `docker network inspect <red>`.

### 11.3. "Stripe no está configurado" al pagar

Falta `stripe_secret_key` en SiteSettings. Ir a `/admin/settings` y rellenarlo. **No olvides reiniciar** o esperar 60 s al cache TTL.

### 11.4. Webhook Stripe responde 400 "Firma inválida"

El `stripe_webhook_secret` no coincide con el del endpoint configurado en Stripe.

1. En Stripe → Developers → Webhooks → tu endpoint → **Signing secret** → copiar.
2. Pegar en `/admin/settings` → `stripe_webhook_secret`.
3. **Reiniciar el contenedor app** desde Portainer (más fiable que esperar el cache TTL).

### 11.5. Las imágenes subidas desaparecen al actualizar

Comprobar que el volumen `uploads` está montado:

```bash
docker volume inspect ecommerce_uploads
docker compose exec app ls -la /app/public/uploads
```

Si el volumen no existe o está vacío, **DETÉN INMEDIATAMENTE** el deploy y revisa la sección `volumes:` del `docker-compose.yml`. Las actualizaciones que hayas hecho destruirán los uploads si no estaban en volumen.

### 11.6. La BD se llena y queda lenta

```bash
# Ver tamaño de las tablas
docker compose exec db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce -e \
  "SELECT TABLE_NAME, ROUND(DATA_LENGTH/1024/1024, 2) AS size_mb \
   FROM information_schema.TABLES WHERE TABLE_SCHEMA='ecommerce' \
   ORDER BY size_mb DESC LIMIT 20;"
```

Tablas que crecen: `webhook_events`, `audit_logs` (cuando esté cableado), `stock_movements`. Implementar limpieza periódica (eliminar webhooks `processed_at` > 90 días).

### 11.7. Healthcheck devuelve 503

```bash
docker compose exec app wget -qO- http://localhost:3000/api/health
# {"status":"degraded","db":"down","error":"..."}
```

La app no llega a la BD. Verificar:

- Servicio `db` corriendo y healthy: `docker compose ps`.
- Variables `MYSQL_*` y `DATABASE_URL` coherentes.
- Red docker funcional: `docker network inspect ecommerce_ecommerce-net`.

### 11.8. SMTP no envía emails

```bash
# Mirar logs del contenedor app cuando el usuario se registra/recibe pedido
docker compose logs app | grep -i smtp
```

- Verificar `smtp_host`/`smtp_port`/`smtp_user`/`smtp_pass`/`smtp_from` en `/admin/settings`.
- Algunos proveedores SMTP requieren contraseñas específicas de aplicación (Gmail, Office365). Generar una.
- Si el proveedor SMTP bloquea por IP del VPS, considerar usar un servicio transaccional (SendGrid, Mailgun, Resend, Brevo).

---

## Apéndice A — Despliegue de múltiples tiendas en el mismo VPS

Cada tienda = un stack independiente en Portainer. Para evitar colisiones:

1. **Carpeta única por cliente:** `/opt/ecommerce-clientex`, `/opt/ecommerce-clientey`.
2. **Nombres de contenedor distintos:** editar `container_name` en cada `docker-compose.yml`:
   ```yaml
   app:    container_name: ecommerce-clientex-app
   db:     container_name: ecommerce-clientex-db
   ```
3. **Redes con prefijo:** Portainer prefija automáticamente `<stackname>_ecommerce-net`, así que no hay colisión.
4. **Volúmenes con prefijo:** igual, Portainer los prefija.
5. **Puerto en host (si lo expones):** distinto por cliente. Mejor: NO exponer y dejar que el reverse proxy resuelva por dominio.
6. **Reverse proxy:** una entrada por dominio, todas apuntando a sus respectivos contenedores.

Recursos por tienda (estimación inicial, ajustable):

- **CPU:** 0.5-1 core en idle, 2 cores en pico.
- **RAM:** 512MB-1GB.
- **Disco:** 5GB de inicio + crecimiento por uploads y BD.

Un VPS de 4 vCPU / 8GB / 80GB SSD aguanta razonablemente 5-8 tiendas pequeñas.

---

## Apéndice B — Checklist resumen de deploy

Para usar como guía rápida cada vez que despliegues una tienda nueva:

```
PRE-REQUISITOS
[ ] DNS apuntando al VPS (A record)
[ ] Datos del cliente recopilados (dominio, Stripe, SMTP, legales)
[ ] Reverse proxy configurado o listo para configurar

DEPLOY
[ ] Carpeta /opt/ecommerce-cliente creada
[ ] Repo clonado o imagen descargada
[ ] Secretos generados (NEXTAUTH_SECRET, MYSQL_PASSWORD x2)
[ ] Stack creado en Portainer con env vars
[ ] Stack desplegado y contenedores running
[ ] Reverse proxy configurado y SSL emitido

PRIMER LOGIN
[ ] Logs de app revisados, password admin anotada
[ ] Login en /admin/login OK
[ ] Password admin cambiada
[ ] /api/health responde 200

CONFIGURACIÓN
[ ] Branding (logo, nombre, favicon)
[ ] SEO defaults
[ ] SMTP configurado y probado
[ ] Métodos de envío creados
[ ] Categorías y productos iniciales
[ ] Páginas legales subidas (5 mínimo)
[ ] Stripe: claves + webhook + signing secret
[ ] Test webhook desde dashboard → 200 OK
[ ] Datos del vendedor para facturas (CIF, dirección, email)
[ ] Crones configurados (cron-job.org o side-car)

SMOKE TEST
[ ] Compra completa con 4242 4242 4242 4242 → CONFIRMED
[ ] Email de confirmación llega
[ ] Factura PDF descargable desde /admin/orders/<id>
[ ] Newsletter doble opt-in funcional
[ ] Refund desde Stripe → email de reembolso + stock restituido
[ ] Cron cleanup manual responde 200

MANTENIMIENTO PROGRAMADO
[ ] Cron de backup de BD instalado
[ ] Cron de backup de uploads instalado
[ ] Monitorización del dominio (UptimeRobot u otro)
```
