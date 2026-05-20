/**
 * Modelo de consentimiento de cookies (RGPD).
 *
 * Categorías:
 *   - `necessary` — siempre `true`. Cookies de sesión, carrito, CSRF…
 *     No requieren consent (interés legítimo).
 *   - `analytics` — Google Analytics, Plausible, Hotjar… requieren opt-in.
 *   - `marketing` — Meta Pixel, Google Ads, retargeting… requieren opt-in.
 *
 * Persistencia: cookie `eshop_cookies_consent` con JSON `{necessary,analytics,marketing,version,ts}`.
 * TTL 12 meses (recomendación de la AEPD para que el banner no aparezca
 * cada visita y al mismo tiempo se renueve el consentimiento anualmente).
 *
 * `version` permite invalidar consents previos cuando cambias la política
 * (ej. añades Meta Pixel y necesitas que el usuario re-acepte). Bumpear
 * `CONSENT_VERSION` reseteará todos los consents y mostrará el banner de nuevo.
 */
export const CONSENT_COOKIE = 'eshop_cookies_consent';
export const CONSENT_TTL_DAYS = 365;
export const CONSENT_VERSION = 1;

export interface ConsentState {
    necessary: true; // siempre
    analytics: boolean;
    marketing: boolean;
    version: number;
    ts: number; // epoch ms
}

export const DEFAULT_CONSENT: ConsentState = {
    necessary: true,
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
    ts: 0
};

export function parseConsent(raw: string | undefined | null): ConsentState | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
        if (parsed.version !== CONSENT_VERSION) return null;
        return {
            necessary: true,
            analytics: !!parsed.analytics,
            marketing: !!parsed.marketing,
            version: CONSENT_VERSION,
            ts: typeof parsed.ts === 'number' ? parsed.ts : 0
        };
    } catch {
        return null;
    }
}

export function serializeConsent(state: Omit<ConsentState, 'ts' | 'version' | 'necessary'>): string {
    const full: ConsentState = {
        necessary: true,
        analytics: state.analytics,
        marketing: state.marketing,
        version: CONSENT_VERSION,
        ts: Date.now()
    };
    return encodeURIComponent(JSON.stringify(full));
}
