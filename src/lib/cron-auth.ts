import { timingSafeEqual } from 'crypto';

/**
 * Autorización para endpoints de cron.
 *
 * Patrón: el job externo (cron-job.org, side-car del docker-compose, etc.)
 * llama al endpoint con la cabecera:
 *
 *   x-cron-secret: <CRON_SECRET>
 *
 * El secret se compara con `timingSafeEqual` para evitar timing attacks
 * en caso de que un atacante intentara fuerza bruta. Si no hay
 * `CRON_SECRET` configurado, se rechazan TODAS las peticiones (fail-safe).
 */
export class CronAuthError extends Error {
    constructor(message = 'Cron auth failed') {
        super(message);
        this.name = 'CronAuthError';
    }
}

export function verifyCronAuth(req: Request): void {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        throw new CronAuthError('CRON_SECRET not configured');
    }
    const provided = req.headers.get('x-cron-secret') || '';
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new CronAuthError('Invalid cron secret');
    }
}
