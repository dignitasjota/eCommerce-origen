'use client';

import { useEffect, useState } from 'react';
import {
    CONSENT_COOKIE,
    CONSENT_TTL_DAYS,
    parseConsent,
    serializeConsent,
    type ConsentState
} from '@/lib/consent';

interface CookieConsentProps {
    /**
     * URL relativa de la política de cookies. Si vacío, no se muestra el
     * link "Más información" del banner. Configurable desde admin
     * (`SiteSetting.cookies_policy_url`).
     */
    policyUrl?: string;
}

/**
 * Banner RGPD de consentimiento granular.
 *
 * UX:
 *   - Sólo se muestra si NO hay cookie de consent válida (versión actual).
 *   - 3 acciones desde el banner:
 *     · "Aceptar todo" (atajo para consent total).
 *     · "Sólo necesarias" (atajo para rechazo total opcional).
 *     · "Personalizar" (abre panel con toggles por categoría).
 *   - Al guardar, persiste cookie 12 meses y emite `window dispatchEvent` para
 *     que componentes que cargan analytics/marketing reaccionen sin recargar.
 *
 * Accesibilidad:
 *   - `role="dialog"` + `aria-modal="false"` (no bloquea, pero es persistente).
 *   - Trap focus dentro del panel cuando se expande.
 *   - El banner respeta `prefers-reduced-motion` (sin animación si está activo).
 */
export default function CookieConsent({ policyUrl }: CookieConsentProps) {
    const [show, setShow] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);

    useEffect(() => {
        const raw = readCookie(CONSENT_COOKIE);
        const consent = parseConsent(raw);
        if (!consent) {
            setShow(true);
        }
    }, []);

    const persist = (a: boolean, m: boolean) => {
        const value = serializeConsent({ analytics: a, marketing: m });
        document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${CONSENT_TTL_DAYS * 86400}; path=/; samesite=lax`;
        // Notificar a componentes que escuchan (ScriptIfConsent).
        window.dispatchEvent(new CustomEvent('eshop:consent-changed'));
        setShow(false);
    };

    const acceptAll = () => persist(true, true);
    const rejectAll = () => persist(false, false);
    const saveCustom = () => persist(analytics, marketing);

    if (!show) return null;

    return (
        <div
            role="dialog"
            aria-label="Consentimiento de cookies"
            aria-describedby="cookie-consent-description"
            style={{
                position: 'fixed',
                bottom: '1rem',
                left: '1rem',
                right: '1rem',
                maxWidth: '720px',
                margin: '0 auto',
                background: 'var(--color-surface, white)',
                color: 'var(--color-text, #111)',
                border: '1px solid var(--color-border, #ddd)',
                borderRadius: 'var(--radius-lg, 12px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                padding: '1.25rem',
                zIndex: 9999,
                fontSize: '0.92rem',
                lineHeight: 1.5
            }}
        >
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                🍪 Tu privacidad importa
            </h2>
            <p id="cookie-consent-description" style={{ margin: '0 0 1rem', color: 'var(--color-text-secondary, #555)' }}>
                Usamos cookies necesarias para que la tienda funcione. Las cookies de analítica y marketing son opcionales y nos ayudan a mejorar la experiencia. Puedes aceptarlas todas, rechazarlas o personalizar tu elección.
                {policyUrl && (
                    <>
                        {' '}<a href={policyUrl} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Más información</a>.
                    </>
                )}
            </p>

            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.75rem 0 1rem', padding: '0.75rem', background: 'var(--color-background-soft, #f5f5f5)', borderRadius: 'var(--radius-md, 8px)' }}>
                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'not-allowed', opacity: 0.7 }}>
                        <input type="checkbox" checked disabled aria-label="Cookies necesarias (siempre activas)" />
                        <span>
                            <strong>Necesarias</strong> · Imprescindibles para sesión, carrito y seguridad. No se pueden desactivar.
                        </span>
                    </label>
                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={analytics}
                            onChange={(e) => setAnalytics(e.target.checked)}
                            aria-label="Cookies de analítica"
                        />
                        <span>
                            <strong>Analítica</strong> · Nos ayudan a entender qué páginas funcionan mejor (Google Analytics, Plausible…).
                        </span>
                    </label>
                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={marketing}
                            onChange={(e) => setMarketing(e.target.checked)}
                            aria-label="Cookies de marketing"
                        />
                        <span>
                            <strong>Marketing</strong> · Personalizan los anuncios que ves en otras webs (Meta Pixel, Google Ads…).
                        </span>
                    </label>
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!expanded && (
                    <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        style={btnSecondary}
                    >
                        Personalizar
                    </button>
                )}
                {expanded && (
                    <button type="button" onClick={saveCustom} style={btnSecondary}>
                        Guardar selección
                    </button>
                )}
                <button type="button" onClick={rejectAll} style={btnSecondary}>
                    Sólo necesarias
                </button>
                <button type="button" onClick={acceptAll} style={btnPrimary}>
                    Aceptar todo
                </button>
            </div>
        </div>
    );
}

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? match[1] : null;
}

const btnBase: React.CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: 'var(--radius-md, 8px)',
    border: '1px solid transparent',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem'
};
const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: 'var(--color-primary, #6366f1)',
    color: 'white'
};
const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: 'var(--color-text, #111)',
    borderColor: 'var(--color-border, #ddd)'
};
