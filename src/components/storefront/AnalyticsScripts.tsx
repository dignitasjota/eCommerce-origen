'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { CONSENT_COOKIE, parseConsent, type ConsentState } from '@/lib/consent';

interface AnalyticsScriptsProps {
    /** ID de Google Analytics 4 (`G-XXXXXXX`). */
    gaId?: string;
    /** ID de Meta Pixel (numérico). */
    metaPixelId?: string;
}

/**
 * Carga GA4 y Meta Pixel SOLO si el usuario ha dado consent.
 *
 * Reactivo:
 *   - Lee la cookie en cada render.
 *   - Escucha el evento `eshop:consent-changed` que emite <CookieConsent>
 *     al guardar, para activar/desactivar scripts sin recargar página.
 *
 * Si los IDs no están configurados (admin no los ha rellenado), el componente
 * no renderiza nada — la tienda funciona sin analítica por defecto.
 */
export default function AnalyticsScripts({ gaId, metaPixelId }: AnalyticsScriptsProps) {
    const [consent, setConsent] = useState<ConsentState | null>(null);

    useEffect(() => {
        const refresh = () => setConsent(parseConsent(readCookie(CONSENT_COOKIE)));
        refresh();
        window.addEventListener('eshop:consent-changed', refresh);
        return () => window.removeEventListener('eshop:consent-changed', refresh);
    }, []);

    return (
        <>
            {/* Google Analytics 4 — sólo con consent.analytics */}
            {gaId && consent?.analytics && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
                        strategy="afterInteractive"
                    />
                    <Script id="ga4-init" strategy="afterInteractive">
                        {`
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${gaId}', { anonymize_ip: true });
                        `}
                    </Script>
                </>
            )}

            {/* Meta Pixel — sólo con consent.marketing */}
            {metaPixelId && consent?.marketing && (
                <>
                    <Script id="meta-pixel" strategy="afterInteractive">
                        {`
                            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
                            'https://connect.facebook.net/en_US/fbevents.js');
                            fbq('init', '${metaPixelId}');
                            fbq('track', 'PageView');
                        `}
                    </Script>
                    {/* Fallback noscript para usuarios sin JS */}
                    <noscript>
                        <img
                            height="1"
                            width="1"
                            style={{ display: 'none' }}
                            src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                            alt=""
                        />
                    </noscript>
                </>
            )}
        </>
    );
}

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? match[1] : null;
}
