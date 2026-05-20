import Link from 'next/link';

interface AdminPaginationProps {
    /** URL base sin querystring (ej: "/es/admin/products"). */
    basePath: string;
    page: number;
    totalPages: number;
    /** Otros searchParams a preservar al cambiar de página. */
    extraParams?: Record<string, string | undefined>;
}

/**
 * Paginación numérica para listados admin. Renderiza como server-component
 * (no necesita JS) y enlaces que preservan los demás searchParams (filtros,
 * búsqueda) — por ese motivo se pasan explícitamente.
 *
 * Estrategia de "ventana": mostramos primera/última siempre, las 2 vecinas
 * de la actual, y elipsis donde haya saltos. Útil para listas con cientos
 * de páginas.
 */
export default function AdminPagination({ basePath, page, totalPages, extraParams }: AdminPaginationProps) {
    if (totalPages <= 1) return null;

    const buildUrl = (p: number) => {
        const params = new URLSearchParams();
        if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) {
                if (v) params.set(k, v);
            }
        }
        params.set('page', String(p));
        return `${basePath}?${params.toString()}`;
    };

    // Generar conjunto de páginas a mostrar.
    const window = new Set<number>();
    window.add(1);
    window.add(totalPages);
    for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
        window.add(p);
    }
    const sorted = Array.from(window).sort((a, b) => a - b);

    // Insertar marcadores de elipsis donde hay saltos > 1.
    const items: Array<number | 'ellipsis'> = [];
    for (let i = 0; i < sorted.length; i++) {
        items.push(sorted[i]);
        if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) items.push('ellipsis');
    }

    return (
        <nav aria-label="Paginación" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {page > 1 && (
                <Link href={buildUrl(page - 1)} className="admin-btn admin-btn-secondary" aria-label="Página anterior">
                    ←
                </Link>
            )}
            {items.map((item, i) =>
                item === 'ellipsis' ? (
                    <span key={`e-${i}`} aria-hidden style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-tertiary)' }}>…</span>
                ) : (
                    <Link
                        key={item}
                        href={buildUrl(item)}
                        className={`admin-btn ${item === page ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        aria-current={item === page ? 'page' : undefined}
                    >
                        {item}
                    </Link>
                )
            )}
            {page < totalPages && (
                <Link href={buildUrl(page + 1)} className="admin-btn admin-btn-secondary" aria-label="Página siguiente">
                    →
                </Link>
            )}
        </nav>
    );
}
