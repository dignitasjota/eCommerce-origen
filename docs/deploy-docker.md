# Deploy con Docker / Portainer

Esta guía cubre el despliegue de la plantilla como contenedores en un VPS con Portainer. El diseño está pensado para que cada cliente tenga su propia instancia con configuración independiente.

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  VPS (con Portainer)                            │
│                                                 │
│  ┌──────────────┐         ┌──────────────────┐  │
│  │   reverse    │  HTTPS  │  ecommerce-app   │  │
│  │  proxy       │────────▶│  (Next.js)       │  │
│  │  (Traefik /  │  :3000  │                  │  │
│  │   Caddy /    │         └────────┬─────────┘  │
│  │   nginx)     │                  │            │
│  └──────────────┘                  │ MySQL      │
│        │                           │            │
│        │ :443                      ▼            │
│        ▼                  ┌──────────────────┐  │
│   Internet                │  ecommerce-db    │  │
│                           │  (MariaDB 10.11) │  │
│                           └──────────────────┘  │
│                                                 │
│  Volúmenes persistentes:                        │
│   - db-data    (datos MySQL)                    │
│   - uploads    (imágenes subidas desde admin)   │
│   - themes     (CSS de temas custom)            │
└─────────────────────────────────────────────────┘
```

La aplicación **arranca con la BD vacía** y se autoconfigura:

1. Espera a que MariaDB esté lista.
2. Aplica el schema con `prisma db push` (idempotente).
3. Ejecuta el seed de bootstrap (idempotente):
   - SiteSettings con valores por defecto (sin sobrescribir si ya existen).
   - Categoría raíz "general".
   - Usuario admin inicial (sólo si no hay ningún ADMIN en la BD).
4. Lanza el servidor Node.js.

Las **claves sensibles** (Stripe, SMTP, branding, etc.) **NO** van como env vars de Docker. Se configuran desde el panel admin tras el primer login en `/admin/settings`, `/admin/payments`, etc.

---

## Despliegue desde cero (5 minutos)

### Opción A — Portainer Web UI

1. **Crear stack** en Portainer → **Stacks → Add stack**.
2. Pegar el contenido de `docker-compose.yml`.
3. En la sección **Environment variables**, añadir las del bloque siguiente (copiadas de `.env.docker.example`):
   ```
   NEXTAUTH_URL=https://tienda.tucliente.com
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   MYSQL_DATABASE=ecommerce
   MYSQL_USER=ecommerce
   MYSQL_PASSWORD=<password seguro>
   MYSQL_ROOT_PASSWORD=<password root seguro>
   ADMIN_EMAIL=admin@tucliente.com
   ADMIN_PASSWORD=        # (vacío = se genera al azar y se imprime en logs)
   ```
4. **Deploy the stack**.
5. Esperar 1-2 minutos. En **Containers → ecommerce-app → Logs** verás:
   ```
   ⏳ Esperando a la base de datos...
   ✅ Base de datos accesible.
   📦 Sincronizando schema (prisma db push)...
   🌱 Ejecutando seed inicial (idempotente):
     · 10 ajustes verificados
     · categoría raíz "general" creada
     · ADMIN INICIAL CREADO
       email:    admin@tucliente.com
       password: <password generada>
       ⚠️  CAMBIA LA CONTRASEÑA EN EL PRIMER LOGIN.
   ✅ Seed completado.
   🚀 Lanzando servidor...
   ```
6. **Apuntar el reverse proxy** del VPS (Traefik / nginx-proxy-manager / Caddy) al puerto 3000 del contenedor `ecommerce-app`.
7. Visitar `https://tienda.tucliente.com/admin/login` → entrar con las credenciales del paso 5 → cambiar la contraseña.

### Opción B — CLI (sobre el host del VPS)

```bash
# 1. Clonar el repo en el VPS
git clone <repo> ecommerce
cd ecommerce

# 2. Configurar variables
cp .env.docker.example .env
nano .env   # editar valores

# 3. Build y arranque
docker compose up -d --build

# 4. Logs (para ver la password del admin si no la fijaste)
docker compose logs -f app
```

---

## Configuración post-deploy (desde el admin)

Tras el primer login en `https://tu-dominio/admin`:

1. **Ajustes generales** → `/admin/settings`
   - `site_name`, `site_logo`, `site_favicon`.
   - `pages_prefix`, `currency`.
   - SEO defaults (`seo_default_title`, `seo_default_description`, `seo_twitter_handle`).
   - SMTP (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`).
2. **Pasarelas de pago** → `/admin/payments` (o donde añadas el form):
   - `stripe_secret_key` — clave secreta `sk_live_…` o `sk_test_…`.
   - `stripe_webhook_secret` — `whsec_…` (ver §Stripe abajo).
   - `stripe_publishable_key` — `pk_live_…` (opcional, para Elements futuros).
3. **Categorías y productos** → `/admin/categories`, `/admin/products`.
4. **Métodos de envío** → `/admin/shipping`.
5. **Páginas legales** → `/admin/legal` (políticas obligatorias por GDPR).

---

## Configurar Stripe

1. Crear cuenta en https://dashboard.stripe.com (o usar la del cliente).
2. **Developers → API keys** → copiar `sk_live_…` (o `sk_test_…` para pruebas).
3. Pegar en `/admin/settings` (o donde se cablee) como `stripe_secret_key`.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://tienda.tucliente.com/api/webhooks/stripe`
   - Eventos:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
     - `charge.refunded`
     - `payment_intent.canceled`
5. Tras crear el endpoint, copiar el **Signing secret** (`whsec_…`) y pegarlo en `/admin/settings` como `stripe_webhook_secret`.
6. Probar con tarjeta `4242 4242 4242 4242` (CVC `123`, fecha futura, ZIP `00000`).

> Cambios en `stripe_secret_key` o `stripe_webhook_secret` tardan ≤ 60 s en propagarse al runtime (cache TTL en `lib/stripe.ts`). Si quieres aplicarlos al instante, reinicia el contenedor.

---

## Operaciones comunes

### Ver logs

```bash
docker compose logs -f app
docker compose logs -f db
```

### Backup manual de la BD

```bash
docker compose exec db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce > backup-$(date +%Y%m%d).sql
```

> Para automatizarlo recomiendo un container side-car con `mariadb-backup` programado por cron. No incluido por simplicidad.

### Restaurar backup

```bash
docker compose exec -T db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce < backup.sql
```

### Actualizar a una nueva versión de la plantilla

```bash
git pull
docker compose build app
docker compose up -d app   # sólo reconstruye y reinicia la app
```

El entrypoint aplica las migraciones automáticamente. Si los cambios son aditivos (lo normal), no hay downtime de datos.

### Resetear admin (olvidé la password)

```bash
docker compose exec db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" ecommerce \
  -e "DELETE FROM users WHERE role='ADMIN';"
docker compose restart app
# → el seed-bootstrap creará un admin nuevo y la imprime en logs
```

### Ver volúmenes

```bash
docker volume ls | grep ecommerce
docker volume inspect ecommerce_uploads
```

### Acceder a la BD desde fuera (sólo cuando necesario)

Por defecto la BD no expone puerto al host. Para abrir temporalmente:

```yaml
# Añadir en docker-compose.yml bajo db:
ports:
  - "127.0.0.1:33060:3306"  # solo accesible desde localhost del VPS
```

Y conectarse con `mysql -h 127.0.0.1 -P 33060 -u ecommerce -p`.

---

## Troubleshooting

### "Stripe no está configurado" al pagar

Falta rellenar `stripe_secret_key` en SiteSettings. Ir a `/admin/settings` (o donde lo cablees).

### Las imágenes subidas desaparecen al reconstruir

Comprueba que el volumen `uploads` está montado correctamente. `docker volume inspect ecommerce_uploads` debe existir y `docker compose exec app ls /app/public/uploads` debe mostrar archivos.

### Error "Firma inválida" del webhook Stripe

El `stripe_webhook_secret` no coincide con el del endpoint de Stripe. Verificar en `/admin/settings` y refrescar (o reiniciar el contenedor para invalidar el cache).

### Healthcheck devuelve 503

```bash
docker compose exec app wget -qO- http://localhost:3000/api/health
```

Si responde `db: down`, comprobar que el servicio `db` está sano (`docker compose ps`) y la red interna funciona.

### Cambiar `NEXTAUTH_URL` (cambio de dominio)

```bash
# Editar .env, luego:
docker compose up -d --no-deps app
```

> ⚠️ Tras cambiar `NEXTAUTH_URL`, todas las sesiones existentes se invalidan (los JWT firmados anteriormente apuntaban al issuer antiguo).

---

## Pendiente operativo (cuando esté en producción)

- **Reverse proxy con HTTPS**: Traefik / Caddy / nginx-proxy-manager. La app no incluye TLS — confía en el proxy.
- **Backup automatizado** de la BD y de los volúmenes `uploads`/`themes`.
- **Cron de `PENDING_PAYMENT` vencidos** (>30 min): liberar stock + decrementar `coupon.used_count`. Ver `ROADMAP.md` § "Pendientes de código".
