'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker sólo en producción — en `next dev` el SW puede
 * quedarse sirviendo bundles cacheados y romper el Fast Refresh.
 */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Registro fallido (p.ej. entorno sin HTTPS) — la tienda sigue
            // funcionando con normalidad sin las ventajas de la PWA.
        });
    }, []);

    return null;
}
