type AnyRequest = { headers: { get(name: string): string | null } };

/**
 * Rate limiter en memoria por (ip + bucket). Suficiente para Plesk/Passenger
 * que sirve la app en un único proceso por instancia. Si en el futuro la app
 * se replica horizontalmente o se mueve a un edge runtime, sustituir por
 * @upstash/ratelimit (Redis) — el contrato es el mismo: `check(req, opts)`
 * devuelve `{ ok, retryAfter }`.
 *
 * No es un mecanismo de defensa contra DDoS; sirve para frenar fuerza bruta
 * y enumeración (login/register/forgot-password) y abuso del checkout.
 */

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpieza perezosa: cada 1024 inserciones recorremos el mapa eliminando
// entradas vencidas para que no crezca sin límite. Plesk reinicia el proceso
// cada cierto tiempo, así que tampoco se acumula indefinidamente.
let inserts = 0;

function purgeIfNeeded(now: number) {
    if (++inserts < 1024) return;
    inserts = 0;
    for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
    }
}

function clientIp(req: AnyRequest): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]!.trim();
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}

export interface RateLimitOptions {
    bucket: string;
    /** Máximo de peticiones permitidas dentro de la ventana. */
    max: number;
    /** Ventana de tiempo en milisegundos. */
    windowMs: number;
}

export interface RateLimitResult {
    ok: boolean;
    retryAfter: number;
    remaining: number;
}

export function rateLimit(req: AnyRequest, opts: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    purgeIfNeeded(now);

    const ip = clientIp(req);
    const key = `${opts.bucket}:${ip}`;

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { ok: true, retryAfter: 0, remaining: opts.max - 1 };
    }

    if (existing.count >= opts.max) {
        return {
            ok: false,
            retryAfter: Math.ceil((existing.resetAt - now) / 1000),
            remaining: 0
        };
    }

    existing.count++;
    return { ok: true, retryAfter: 0, remaining: opts.max - existing.count };
}
