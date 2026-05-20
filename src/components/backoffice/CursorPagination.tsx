import Link from 'next/link';

interface CursorPaginationProps {
    basePath: string;
    /** Cursor de la página actual (vacío = primera). Lo recibimos para
     *  poder construir el "Anterior" y mantener compatibilidad si en
     *  el futuro guardamos un stack de cursores. */
    currentCursor?: string | null;
    nextCursor: string | null;
    /** Otros searchParams a preservar (filtros). */
    extraParams?: Record<string, string | undefined>;
}

/**
 * Paginación cursor-based para listados que crecen sin límite. Pensada para
 * admin (orders, audit logs, webhook events). Limitaciones por diseño:
 *
 *  - Sólo "siguiente / inicio" — no hay número de página ni total. El cursor
 *    es opaco así que los saltos arbitrarios no son posibles sin reconstruir.
 *  - "Volver al inicio" reinicia la navegación (carga primera página).
 *
 * Si necesitas "anterior", el caller debe mantener el stack de cursores en
 * la URL (`stack=cursorA,cursorB,...`). No incluido aquí por simplicidad.
 */
export default function CursorPagination({
    basePath,
    currentCursor,
    nextCursor,
    extraParams
}: CursorPaginationProps) {
    if (!currentCursor && !nextCursor) return null; // página única

    const buildUrl = (cursor: string | null) => {
        const params = new URLSearchParams();
        if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) {
                if (v) params.set(k, v);
            }
        }
        if (cursor) params.set('cursor', cursor);
        const qs = params.toString();
        return `${basePath}${qs ? `?${qs}` : ''}`;
    };

    return (
        <nav aria-label="Paginación" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <div>
                {currentCursor && (
                    <Link href={buildUrl(null)} className="admin-btn admin-btn-secondary admin-btn-sm">
                        ← Volver al inicio
                    </Link>
                )}
            </div>
            <div>
                {nextCursor ? (
                    <Link href={buildUrl(nextCursor)} className="admin-btn admin-btn-primary admin-btn-sm">
                        Siguiente →
                    </Link>
                ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                        No hay más resultados
                    </span>
                )}
            </div>
        </nav>
    );
}
