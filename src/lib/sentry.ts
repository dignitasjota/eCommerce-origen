/**
 * Wrapper de Sentry — integración opcional, activable con `SENTRY_DSN`.
 *
 * Filosofía:
 *   - Sin `SENTRY_DSN` ⇒ todo es no-op. Cero coste, cero dependencia ejecutada.
 *     Esto permite que clientes que no quieran Sentry usen la plantilla sin
 *     tocar código.
 *   - Con `SENTRY_DSN` ⇒ se inicializa al arrancar (server e edge) y los
 *     errores no controlados se reportan con contexto.
 *   - DSN va en env (no en SiteSettings) porque debe estar disponible ANTES
 *     de que Prisma esté listo.
 *
 * Uso:
 *   - Auto-init: importado por `src/instrumentation.ts` de Next.
 *   - Manual: `import { captureError } from '@/lib/sentry'` en catches.
 */

import * as Sentry from '@sentry/nextjs';

let initialized = false;

export function isSentryEnabled(): boolean {
    return !!process.env.SENTRY_DSN;
}

export function initSentry(runtime: 'nodejs' | 'edge'): void {
    if (initialized) return;
    if (!isSentryEnabled()) return;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'production',
        release: process.env.SENTRY_RELEASE || undefined,
        // Sample rate bajo por defecto: para una tienda B2C el volumen de
        // requests sin errores es alto y Sentry cobra por evento. Subir vía
        // env si quieres trazas detalladas.
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
        // No enviar PII por defecto. El admin puede activarlo con SENTRY_SEND_PII=true
        // si necesita correlación con usuarios concretos en debugging.
        sendDefaultPii: process.env.SENTRY_SEND_PII === 'true',
        // El edge runtime no soporta ProfilingIntegration; se filtra solo.
        beforeSend(event) {
            // Filtros mínimos para no mandar ruido conocido.
            const msg = event.exception?.values?.[0]?.value || event.message || '';
            if (typeof msg === 'string') {
                // NextAuth a veces lanza este en flujos válidos.
                if (msg.includes('NEXT_REDIRECT')) return null;
                // Notion habitual: P2002 lo manejamos explícitamente para idempotencia.
                if (msg.includes('Unique constraint')) return null;
            }
            return event;
        }
    });

    initialized = true;
    console.info(`[sentry] enabled (runtime=${runtime})`);
}

/**
 * Captura un error con contexto extra (best-effort: nunca lanza si Sentry falla).
 */
export function captureError(
    err: unknown,
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
    if (!isSentryEnabled()) return;
    try {
        Sentry.captureException(err, {
            tags: context?.tags,
            extra: context?.extra
        });
    } catch {
        // never bubble up
    }
}

/**
 * Versión "fire-and-forget" para usar en server actions sin propagar la promesa.
 */
export function captureErrorAsync(
    err: unknown,
    context?: Parameters<typeof captureError>[1]
): void {
    captureError(err, context);
}
