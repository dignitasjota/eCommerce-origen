'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Global error boundary del App Router.
 *
 * Captura errores que escapan a TODO árbol de la app (incluido el root layout).
 * Sin DSN configurado, `Sentry.captureException` es no-op.
 */
export default function GlobalError({
    error,
    reset
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        padding: '2rem',
                        fontFamily: 'system-ui, sans-serif'
                    }}
                >
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                        Algo ha ido mal
                    </h1>
                    <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                        Hemos registrado el error y lo estamos investigando.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#000',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </body>
        </html>
    );
}
