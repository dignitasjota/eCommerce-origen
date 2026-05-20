import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyCronAuth, CronAuthError } from '@/lib/cron-auth';
import { auditLogServer } from '@/lib/audit';

/**
 * Cron de retención: purga registros antiguos de tablas que crecen sin límite.
 *
 * Trigger recomendado: diario (típicamente de madrugada).
 *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
 *        https://tienda.cliente.com/api/admin/cron/retention
 *
 * Tablas purgadas (ventanas configurables vía SiteSettings):
 *   - WebhookEvent: por defecto 90 días. Tras procesar, sólo sirve para auditoría
 *     forense — no hay caso de uso operativo después de 3 meses.
 *   - AuditLog: por defecto 365 días. La obligación legal típica para logs de
 *     acceso/modificación es 1 año. El admin puede ampliar la ventana en SiteSettings
 *     si su jurisdicción lo exige (ej. RGPD recomienda 2 años para incidentes).
 *   - StockMovement: por defecto 730 días (2 años). Útil para reportes históricos
 *     de inventario.
 *
 * Comportamiento:
 *   1. Lee ventanas desde SiteSettings (con fallback a defaults).
 *   2. `deleteMany` por tabla con guardia de fecha. Sin transacción global —
 *      cada delete es independiente y best-effort.
 *   3. Devuelve resumen JSON con counts por tabla.
 *
 * Idempotente: una segunda ejecución sin cambios devuelve count=0.
 *
 * SiteSettings reconocidos:
 *   - retention_webhook_event_days (default 90)
 *   - retention_audit_log_days (default 365)
 *   - retention_stock_movement_days (default 730)
 */
export const dynamic = 'force-dynamic';

const DEFAULT_WEBHOOK_DAYS = 90;
const DEFAULT_AUDIT_DAYS = 365;
const DEFAULT_STOCK_DAYS = 730;

async function readWindowDays(key: string, fallback: number): Promise<number> {
    try {
        const row = await prisma.siteSetting.findUnique({ where: { key } });
        const parsed = parseInt(row?.value ?? '', 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
        // best-effort
    }
    return fallback;
}

function cutoff(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
    try {
        verifyCronAuth(req);
    } catch (e) {
        if (e instanceof CronAuthError) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        throw e;
    }

    const [webhookDays, auditDays, stockDays] = await Promise.all([
        readWindowDays('retention_webhook_event_days', DEFAULT_WEBHOOK_DAYS),
        readWindowDays('retention_audit_log_days', DEFAULT_AUDIT_DAYS),
        readWindowDays('retention_stock_movement_days', DEFAULT_STOCK_DAYS)
    ]);

    const result: Record<string, { deleted: number; cutoff: string; error?: string }> = {};

    try {
        const c = cutoff(webhookDays);
        const r = await prisma.webhookEvent.deleteMany({ where: { processed_at: { lt: c } } });
        result.webhook_events = { deleted: r.count, cutoff: c.toISOString() };
    } catch (e: unknown) {
        result.webhook_events = { deleted: 0, cutoff: '', error: (e instanceof Error ? e.message : 'failed') };
    }

    try {
        const c = cutoff(auditDays);
        const r = await prisma.auditLog.deleteMany({ where: { created_at: { lt: c } } });
        result.audit_logs = { deleted: r.count, cutoff: c.toISOString() };
    } catch (e: unknown) {
        result.audit_logs = { deleted: 0, cutoff: '', error: (e instanceof Error ? e.message : 'failed') };
    }

    try {
        const c = cutoff(stockDays);
        const r = await prisma.stockMovement.deleteMany({ where: { created_at: { lt: c } } });
        result.stock_movements = { deleted: r.count, cutoff: c.toISOString() };
    } catch (e: unknown) {
        result.stock_movements = { deleted: 0, cutoff: '', error: (e instanceof Error ? e.message : 'failed') };
    }

    const totalDeleted = Object.values(result).reduce((acc, r) => acc + r.deleted, 0);

    // Auditoría del propio job — útil para detectar volúmenes anómalos.
    await auditLogServer({
        action: 'cron.retention',
        entity_type: 'System',
        metadata: { result, total_deleted: totalDeleted }
    });

    return NextResponse.json({ ok: true, result, total_deleted: totalDeleted });
}
