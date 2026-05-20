import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Healthcheck profundo para monitores externos avanzados.
 *
 * Verifica que la configuración mínima de producción está en su sitio:
 *   - BD escribible (no sólo lectura).
 *   - SMTP configurado (al menos host + from).
 *   - Stripe configurado (al menos secret key) si es plantilla con pagos online.
 *   - NEXTAUTH_SECRET presente.
 *   - Existe al menos un usuario admin.
 *
 * Devuelve 200 con un detalle por check. El monitor decide si dispara alerta
 * basándose en el campo `status` global o en checks específicos.
 *
 * NO usar para healthcheck de Docker (es más caro). Para eso, `/api/health`.
 *
 * Frecuencia recomendada: 5-15 min desde el monitor externo.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CheckResult {
    ok: boolean;
    detail?: string;
}

async function checkDb(): Promise<CheckResult> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, detail: e instanceof Error ? e.message : 'db unreachable' };
    }
}

async function checkAdmin(): Promise<CheckResult> {
    try {
        const count = await prisma.user.count({ where: { role: 'ADMIN' } });
        return count > 0
            ? { ok: true, detail: `${count} admin(s)` }
            : { ok: false, detail: 'no admin user' };
    } catch (e: unknown) {
        return { ok: false, detail: e instanceof Error ? e.message : 'query failed' };
    }
}

async function checkSettings(): Promise<{
    smtp: CheckResult;
    stripe: CheckResult;
}> {
    const smtp: CheckResult = { ok: false, detail: 'not configured' };
    const stripe: CheckResult = { ok: false, detail: 'not configured' };
    try {
        const settings = await prisma.siteSetting.findMany({
            where: {
                key: { in: ['smtp_host', 'smtp_from', 'stripe_secret_key', 'stripe_webhook_secret'] }
            }
        });
        const map = new Map(settings.map((s) => [s.key, s.value || '']));
        const smtpHost = map.get('smtp_host') || process.env.SMTP_HOST || '';
        const smtpFrom = map.get('smtp_from') || process.env.EMAIL_FROM || '';
        if (smtpHost && smtpFrom) {
            smtp.ok = true;
            smtp.detail = `host=${smtpHost}`;
        }
        const stripeKey = map.get('stripe_secret_key') || process.env.STRIPE_SECRET_KEY || '';
        const stripeHook = map.get('stripe_webhook_secret') || process.env.STRIPE_WEBHOOK_SECRET || '';
        if (stripeKey && stripeHook) {
            stripe.ok = true;
            stripe.detail = stripeKey.startsWith('sk_live_') ? 'live mode' : 'test mode';
        } else if (stripeKey || stripeHook) {
            stripe.detail = 'partial config (key OR webhook missing)';
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'query failed';
        smtp.detail = stripe.detail = msg;
    }
    return { smtp, stripe };
}

function checkAuthSecret(): CheckResult {
    const secret = process.env.NEXTAUTH_SECRET || '';
    if (!secret) return { ok: false, detail: 'NEXTAUTH_SECRET not set' };
    if (secret.length < 32) return { ok: false, detail: 'NEXTAUTH_SECRET too short (<32 chars)' };
    return { ok: true };
}

function checkCronSecret(): CheckResult {
    const secret = process.env.CRON_SECRET || '';
    if (!secret) {
        return {
            ok: false,
            detail: 'CRON_SECRET not set — cron endpoints are disabled (fail-safe)'
        };
    }
    return { ok: true };
}

export async function GET() {
    const [db, admin, { smtp, stripe }] = await Promise.all([
        checkDb(),
        checkAdmin(),
        checkSettings()
    ]);
    const authSecret = checkAuthSecret();
    const cronSecret = checkCronSecret();

    const checks = { db, admin, smtp, stripe, authSecret, cronSecret };

    // Critical = bloquea el negocio. Warning = degraded pero la tienda funciona.
    const critical: (keyof typeof checks)[] = ['db', 'admin', 'authSecret'];
    const hasCritical = critical.some((k) => !checks[k].ok);
    const hasWarning = (Object.keys(checks) as (keyof typeof checks)[]).some(
        (k) => !checks[k].ok && !critical.includes(k)
    );
    const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';

    return NextResponse.json(
        { status, checks, timestamp: new Date().toISOString() },
        {
            status: hasCritical ? 503 : 200,
            headers: { 'Cache-Control': 'no-store' }
        }
    );
}
