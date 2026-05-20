import { initSentry } from '@/lib/sentry';

/**
 * Hook de instrumentación de Next.js (App Router).
 *
 * Se ejecuta una vez al arrancar el servidor. Inicializa Sentry si está
 * activado vía `SENTRY_DSN`. Sin DSN, esta función es prácticamente no-op.
 *
 * Se invoca tanto para `nodejs` como para `edge` runtime.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        initSentry('nodejs');
    } else if (process.env.NEXT_RUNTIME === 'edge') {
        initSentry('edge');
    }
}

/**
 * Hook que reporta errores que escapan a la app a Sentry. Sin DSN configurado
 * es no-op (el wrapper guarda esa lógica internamente).
 */
export { captureRequestError } from '@sentry/nextjs';
