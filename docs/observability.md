# Observability — Sentry para errores no controlados

Guía para activar reporte de errores con [Sentry](https://sentry.io). La integración es **opcional**: sin DSN configurado, no hay overhead ni dependencia activa, todo funciona como antes.

## Por qué activarlo

Con la pipeline actual, cuando ocurre un error inesperado en producción:

- **Error en server action** ⇒ `console.error` → log del contenedor (volátil, sin búsqueda).
- **Error en webhook Stripe** ⇒ devuelve 500, Stripe reintenta, pero no sabes por qué.
- **Crash en cliente** ⇒ el usuario ve el `global-error.tsx`, tú no te enteras.

Con Sentry activo:

- Stack traces con contexto, request, sesión (anonimizada) y árbol de releases.
- Agrupación automática por tipo de error → "el webhook falla 12 veces al día con `claimInvoiceNumber: deadlock detected`" en lugar de ruido en logs.
- Alertas Slack/email ante regresiones (no por cada error, por aumento de frecuencia).

## Setup

### 1. Crear cuenta y proyecto

1. https://sentry.io → cuenta gratis (5k errores/mes incluidos).
2. **Create Project** → plataforma `Next.js`. Nombre del proyecto = el del cliente.
3. Copiar el DSN que aparece (algo como `https://abcdef@o123.ingest.sentry.io/456`).

### 2. Configurar variables del compose

En el `.env` del cliente:

```bash
SENTRY_DSN=https://abcdef@o123.ingest.sentry.io/456
NEXT_PUBLIC_SENTRY_DSN=https://abcdef@o123.ingest.sentry.io/456   # mismo valor
SENTRY_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0.05    # 5% de requests, suficiente para detectar regresiones
```

`docker compose up -d` y listo. La integración se activa al primer arranque.

### 3. Verificación

Provoca un error a propósito (curl a una ruta inexistente que dispare un 500 controlado, o usa Sentry's debug page si quieres):

```bash
# Llamar al endpoint con un payload claramente roto
curl -X POST https://tienda.cliente.com/api/storefront/checkout \
  -H "content-type: application/json" \
  -d '{"items":"not-an-array"}'
```

En 1-2 min debería aparecer en el dashboard de Sentry. Si tras 5 min no aparece, revisa los logs del contenedor `app`:

```bash
docker compose logs app | grep -i sentry
# Debería ver: [sentry] enabled (runtime=nodejs)
```

## Qué se reporta automáticamente

| Origen | Cuándo | Tags |
|---|---|---|
| Webhook Stripe | Error procesando un evento (no firma inválida — eso es 400 esperable) | `area=webhook, provider=stripe, event_type=...` |
| Checkout | Error genérico no clasificado (no 409 de stock/cupón — eso es negocio normal) | `area=checkout` |
| Server actions | Errores no atrapados en el catch genérico | (vía Next instrumentation) |
| Cliente | Crashes que disparan `global-error.tsx` | (release + path automáticos) |

Errores **filtrados** por `beforeSend` (no llegan a Sentry):

- `NEXT_REDIRECT` — falsos positivos de NextAuth en flujos válidos.
- `Unique constraint` — los manejamos explícitamente para idempotencia (`P2002` en webhooks).

## Tuning

### Reducir ruido

```bash
SENTRY_TRACES_SAMPLE_RATE=0.01   # 1% para tiendas con mucho tráfico
```

### Activar replays (sólo si lo necesitas, son pesados)

```bash
NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE=0           # nunca por defecto
NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE=0.5   # capturar replay del 50% de las sesiones que tuvieron error
```

### Releases (recomendado pero opcional)

Si tu pipeline genera tags semver (`v1.0.0`, `v1.0.1`), Sentry agrupa errores por release. Útil para detectar "esto salió en 1.0.1, hay que rollback".

```bash
SENTRY_RELEASE=1.0.1   # típicamente lo inyecta el CI desde el tag
```

El workflow de GitHub Actions ya pasa `${{ steps.version.outputs.version }}` al `docker build`. Para que la imagen lo lleve incrustado, añade en el Dockerfile:

```dockerfile
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
```

Y en el job `docker-publish`:

```yaml
- uses: docker/build-push-action@v6
  with:
    build-args: |
      SENTRY_RELEASE=${{ steps.version.outputs.version }}
```

## Rotación de DSN

El DSN no es secreto ultra-sensible (se publica al cliente vía `NEXT_PUBLIC_SENTRY_DSN`), pero si necesitas rotar:

1. En Sentry → Settings → Client Keys → **Create new key** + revocar la vieja.
2. Editar `.env`, `docker compose up -d` (no requiere `build`, sólo restart).

## Self-hosted (opcional)

Sentry tiene una versión open-source self-hosted. No la cubrimos aquí porque para una plantilla multi-tenant suele compensar más el SaaS (5k errores/mes gratis cubren tiendas pequeñas-medianas). Si vas por self-hosted, sólo cambia `SENTRY_DSN` para apuntar a tu instancia.
