import * as Sentry from '@sentry/nextjs';

/**
 * Inicializa Sentry en el navegador. Sin `NEXT_PUBLIC_SENTRY_DSN` queda en no-op.
 *
 * El DSN del cliente debe estar prefijado `NEXT_PUBLIC_` para inyectarse al
 * bundle. Si quieres usar el mismo del servidor, expón ambas:
 *   SENTRY_DSN=...
 *   NEXT_PUBLIC_SENTRY_DSN=...
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
    Sentry.init({
        dsn,
        environment:
            process.env.NEXT_PUBLIC_SENTRY_ENV ||
            process.env.NODE_ENV ||
            'production',
        tracesSampleRate: parseFloat(
            process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.05'
        ),
        // Replays son útiles pero pesados — sólo activarlos si lo configuras explícito.
        replaysSessionSampleRate: parseFloat(
            process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE || '0'
        ),
        replaysOnErrorSampleRate: parseFloat(
            process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE || '0'
        ),
        sendDefaultPii: false
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
