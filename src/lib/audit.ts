import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export interface AuditEntry {
    /** Acción canónica: "product.create", "order.update_status", etc. */
    action: string;
    /** Tipo de entidad afectada — "Product", "Order", "User"... */
    entity_type: string;
    /** ID de la entidad cuando aplique. */
    entity_id?: string | null;
    /** Datos extra (campos cambiados, before/after). Se serializa a JSON. */
    metadata?: Record<string, unknown>;
}

/**
 * Inserta una entrada en `audit_logs`. Diseñado para ser **best-effort**:
 *   - Lee `userId` de la sesión actual y la IP del request.
 *   - NUNCA lanza: si falla la BD o no hay sesión, lo loguea por consola
 *     y continúa. La idea es que el audit no pueda romper una operación
 *     funcional.
 *
 * Llamar desde server actions DESPUÉS de la operación principal — así
 * sólo registramos lo que realmente se persistió.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
    try {
        const [session, hdrs] = await Promise.all([auth(), headers()]);

        const ip =
            hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            hdrs.get('x-real-ip')?.trim() ||
            null;

        await prisma.auditLog.create({
            data: {
                user_id: session?.user?.id ?? null,
                action: entry.action,
                entity_type: entry.entity_type,
                entity_id: entry.entity_id ?? null,
                metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
                ip_address: ip ? ip.slice(0, 45) : null
            }
        });
    } catch (e) {
        // No interrumpir el flujo principal si el audit falla.
        console.error('[audit] failed:', (e as Error)?.message);
    }
}

/**
 * Variante para contextos sin sesión (webhooks, crons). Recibe `userId`
 * explícito (o null) y opcionalmente IP.
 */
export async function auditLogServer(
    entry: AuditEntry & { user_id?: string | null; ip_address?: string | null }
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                user_id: entry.user_id ?? null,
                action: entry.action,
                entity_type: entry.entity_type,
                entity_id: entry.entity_id ?? null,
                metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
                ip_address: entry.ip_address ? entry.ip_address.slice(0, 45) : null
            }
        });
    } catch (e) {
        console.error('[audit-server] failed:', (e as Error)?.message);
    }
}
