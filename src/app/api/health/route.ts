import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Healthcheck para Docker / Portainer / Traefik / monitores externos.
 *
 * Devuelve 200 si la app puede llegar a la BD. 503 si no.
 * Diseñado para ser barato (`SELECT 1`) y rápido — el healthcheck del
 * docker-compose lo invoca cada 30 s, y monitores externos (UptimeRobot,
 * BetterStack) cada 1-5 min.
 *
 * Para checks profundos (Stripe configurado, SMTP, etc.) usar `/api/health/deep`.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STARTED_AT = Date.now();

export async function GET() {
    const uptimeSeconds = Math.floor((Date.now() - STARTED_AT) / 1000);
    const startedAt = new Date(STARTED_AT).toISOString();

    try {
        await prisma.$queryRaw`SELECT 1`;
        return NextResponse.json(
            { status: 'ok', db: 'up', uptimeSeconds, startedAt },
            { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (e: any) {
        return NextResponse.json(
            {
                status: 'degraded',
                db: 'down',
                uptimeSeconds,
                startedAt,
                error: e?.message || 'unknown'
            },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
