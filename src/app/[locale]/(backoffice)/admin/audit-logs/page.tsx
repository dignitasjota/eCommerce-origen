import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import CursorPagination from '@/components/backoffice/CursorPagination';
import {
    parseCursorParams,
    buildPrismaCursorArgs,
    buildCursorPage
} from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES = [
    'Product', 'Order', 'User', 'Coupon', 'SiteSettings',
    'ProductVariant', 'Return', 'Category', 'BlogPost', 'Page'
] as const;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Visor de auditoría administrativa. Lee la tabla `audit_logs` que se
 * llena best-effort desde server actions, webhooks y crones.
 *
 * Cursor pagination obligatoria: esta tabla crece sin límite (un admin con
 * tráfico medio genera miles de entries al día) y offset+25 sería inviable.
 *
 * Filtros: tipo de entidad y acción (campo libre con `contains`). El user_id
 * y entity_id se pueden filtrar exactos vía URL para investigaciones.
 */
export default async function AuditLogsPage({ params, searchParams }: Props) {
    // Sólo ADMIN: el log puede contener IPs y metadata sensible.
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        notFound();
    }

    const { locale } = await params;
    const sp = await searchParams;

    const cursorParams = parseCursorParams(sp);
    const currentCursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;
    const cursorArgs = buildPrismaCursorArgs(cursorParams);

    const entityTypeRaw = typeof sp.entity_type === 'string' ? sp.entity_type : undefined;
    const entityType = entityTypeRaw && (ENTITY_TYPES as readonly string[]).includes(entityTypeRaw)
        ? entityTypeRaw : undefined;
    const action = typeof sp.action === 'string' && sp.action.trim() ? sp.action.trim() : undefined;
    const userId = typeof sp.user_id === 'string' && sp.user_id.trim() ? sp.user_id.trim() : undefined;
    const entityId = typeof sp.entity_id === 'string' && sp.entity_id.trim() ? sp.entity_id.trim() : undefined;

    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entity_type = entityType;
    if (action) where.action = { contains: action };
    if (userId) where.user_id = userId;
    if (entityId) where.entity_id = entityId;

    const rows = await prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        ...cursorArgs
    });
    const { items: logs, nextCursor } = buildCursorPage(rows, cursorParams.take);

    // Lookup de usuarios para mostrar email/nombre en lugar de UUID.
    const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean) as string[]));
    const users = userIds.length
        ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true }
          })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const basePath = locale === 'es' ? '/admin/audit-logs' : `/${locale}/admin/audit-logs`;
    const filterValues = {
        entity_type: entityTypeRaw ?? '',
        action: action ?? '',
        user_id: userId ?? '',
        entity_id: entityId ?? ''
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Auditoría</h1>
                <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                    Registro inmutable de operaciones del backoffice. Útil para investigar incidencias.
                </p>
            </div>

            <div className="admin-page">
                <form
                    method="GET"
                    className="admin-card"
                    style={{ marginBottom: '1.5rem', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Tipo de entidad</span>
                        <select name="entity_type" defaultValue={entityTypeRaw ?? ''} className="admin-form-input">
                            <option value="">Todas</option>
                            {ENTITY_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Acción contiene</span>
                        <input
                            type="text"
                            name="action"
                            defaultValue={action ?? ''}
                            placeholder="ej. update, delete"
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>User ID exacto</span>
                        <input
                            type="text"
                            name="user_id"
                            defaultValue={userId ?? ''}
                            placeholder="UUID"
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Entity ID exacto</span>
                        <input
                            type="text"
                            name="entity_id"
                            defaultValue={entityId ?? ''}
                            placeholder="UUID"
                            className="admin-form-input"
                        />
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">Filtrar</button>
                        <Link href="?" className="admin-btn admin-btn-secondary admin-btn-sm">Limpiar</Link>
                    </div>
                </form>

                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Usuario</th>
                                <th>Acción</th>
                                <th>Entidad</th>
                                <th>ID</th>
                                <th>IP</th>
                                <th>Metadata</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                const user = log.user_id ? userById.get(log.user_id) : null;
                                return (
                                    <tr key={log.id}>
                                        <td className="text-xs">
                                            {new Date(log.created_at).toLocaleString('es-ES', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="text-xs">
                                            {user ? (
                                                <span title={user.id}>{user.name || user.email}</span>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                        <td><code style={{ fontSize: '0.8rem' }}>{log.action}</code></td>
                                        <td>{log.entity_type}</td>
                                        <td className="text-xs">
                                            {log.entity_id ? <code>{log.entity_id.slice(0, 8)}…</code> : '—'}
                                        </td>
                                        <td className="text-xs">{log.ip_address || '—'}</td>
                                        <td className="text-xs">
                                            {log.metadata ? (
                                                <details>
                                                    <summary style={{ cursor: 'pointer', color: 'var(--color-primary)' }}>
                                                        Ver
                                                    </summary>
                                                    <pre style={{ marginTop: '0.4rem', padding: '0.5rem', background: 'var(--color-background-soft)', borderRadius: 4, fontSize: '0.75rem', maxWidth: 300, overflow: 'auto' }}>
                                                        {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                                                    </pre>
                                                </details>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📋</div>
                                            <h3>Sin registros</h3>
                                            <p>No hay entradas que coincidan con los filtros.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <CursorPagination
                    basePath={basePath}
                    currentCursor={currentCursor}
                    nextCursor={nextCursor}
                    extraParams={filterValues}
                />
            </div>
        </>
    );
}
