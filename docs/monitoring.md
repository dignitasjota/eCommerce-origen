# Monitorización externa

Guía para configurar alertas de uptime y errores sobre una instancia desplegada.

> **Por qué externa:** un monitor externo a tu VPS detecta caídas que `docker compose ps` no ve (problema de DNS, certificado caducado, reverse proxy roto, VPS apagado).

---

## Endpoints disponibles

### `/api/health` — superficial (cada 30 s - 1 min)

Lo que ya usa el `healthcheck` de Docker. Útil para monitores externos baratos.

```bash
curl -s https://tienda.cliente.com/api/health
{
  "status": "ok",
  "db": "up",
  "uptimeSeconds": 12345,
  "startedAt": "2026-05-02T10:00:00.000Z"
}
```

| Status code | Significado |
|---|---|
| 200 | App respira y la BD responde |
| 503 | App responde pero la BD está caída |
| (timeout/conn refused) | App caída o reverse proxy roto |

**Coste:** 1 query trivial (`SELECT 1`). Seguro a alta frecuencia.

### `/api/health/deep` — checks de configuración (cada 5-15 min)

Verifica que la configuración mínima de producción está completa. Útil para detectar **errores de configuración** que no rompen la app pero la dejan inservible (ej. SMTP no configurado ⇒ no se mandan emails de pedidos).

```bash
curl -s https://tienda.cliente.com/api/health/deep | jq
{
  "status": "warning",   // ok | warning | critical
  "checks": {
    "db":          { "ok": true },
    "admin":       { "ok": true, "detail": "1 admin(s)" },
    "smtp":        { "ok": true, "detail": "host=smtp.mailgun.org" },
    "stripe":      { "ok": true, "detail": "live mode" },
    "authSecret":  { "ok": true },
    "cronSecret":  { "ok": false, "detail": "CRON_SECRET not set — cron endpoints are disabled (fail-safe)" }
  },
  "timestamp": "2026-05-02T10:30:00.000Z"
}
```

| Status global | Status code | Cuándo |
|---|---|---|
| `ok` | 200 | Todos los checks pasan |
| `warning` | 200 | Algún check no crítico falla (Stripe sin configurar, sin CRON_SECRET, etc.) |
| `critical` | 503 | BD caída, sin admin o sin NEXTAUTH_SECRET ⇒ la tienda no funciona |

**Coste:** 3 queries cortas. NO usar a alta frecuencia.

---

## Configuración con UptimeRobot (gratis, recomendado)

1. Crear cuenta en https://uptimerobot.com (plan gratuito = 50 monitors, intervalo mínimo 5 min).
2. **Add New Monitor**:
   - **Type**: HTTP(s)
   - **Friendly Name**: `Cliente X — Health`
   - **URL**: `https://tienda.cliente.com/api/health`
   - **Monitoring Interval**: 5 min (gratis) o 1 min (paid).
   - **Alert Contacts**: tu email + Slack/Telegram si lo tienes configurado.
3. **Add New Monitor** (segundo, para `/api/health/deep`):
   - **Type**: Keyword
   - **URL**: `https://tienda.cliente.com/api/health/deep`
   - **Keyword Type**: "should NOT exist"
   - **Keyword Value**: `"status":"critical"`
   - Frecuencia: 15 min.
4. (Opcional) **Add New Monitor** sobre la home pública (`https://tienda.cliente.com/`):
   - Detecta problemas de reverse proxy / certificado que `/api/health` no captura si el monitor llega por dominio interno.

### Alertas

UptimeRobot manda email/SMS/Slack cuando:
- El monitor pasa de "Up" a "Down" (cualquier respuesta != 200).
- Tras N intentos fallidos consecutivos (configurable).

**Recomendación:** mínimo 2 intentos antes de alertar para evitar falsos positivos por blips de red.

---

## Configuración con BetterStack (mejor UX, plan gratuito limitado)

1. Crear cuenta en https://betterstack.com/uptime.
2. **Create monitor**:
   - **URL**: `https://tienda.cliente.com/api/health`
   - **Check frequency**: 30 s (gratis) o 1 min.
   - **Regions**: 2-3 regiones distintas (Europa + USA) para evitar falsos positivos por red local.
3. **On-call**: configurar escalado a Slack / SMS si el incidente persiste >5 min.
4. **Status page**: BetterStack genera una status page pública gratuita por monitor (útil para clientes B2B).

---

## Configuración con cron-job.org (lo más simple, 1 alerta)

Si ya usas cron-job.org para los crones de mantenimiento (`/api/admin/cron/*`), puedes añadir un job HTTP GET sobre `/api/health` con notificación por email cuando devuelva != 200.

No es un monitor profesional, pero cubre el caso "saber si la tienda está caída" gratis y sin cuenta nueva.

---

## Métricas internas (opcional, para escalas mayores)

Si en el futuro quieres dashboards de latencia, throughput o errores por endpoint, las opciones son:

- **Prometheus + Grafana** (self-hosted) — añadir `prom-client` + endpoint `/api/metrics` protegido. Stack pesado.
- **Sentry** — ver [docs/observability.md](./observability.md) (cuando se implemente). Cubre errores no controlados con stack trace + contexto.
- **PostHog / Mixpanel** — si necesitas métricas de producto (funnel, retention) además de técnicas.

Para tiendas pequeñas-medianas, UptimeRobot + Sentry cubren el 95 % del valor con coste mínimo.

---

## Smoke test manual tras deploy

```bash
# 1. App responde
curl -fsS https://tienda.cliente.com/api/health

# 2. Configuración OK
curl -fsS https://tienda.cliente.com/api/health/deep | jq '.status'
# debería devolver "ok" o "warning" (NO "critical")

# 3. Home pública carga (sin auth)
curl -fsS -o /dev/null -w "%{http_code}\n" https://tienda.cliente.com/

# 4. Admin login carga (sin auth)
curl -fsS -o /dev/null -w "%{http_code}\n" https://tienda.cliente.com/auth/login
```

Los cuatro deben devolver 200. Si alguno falla, revisa logs del contenedor `app`.
