'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';

export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'featured';

interface CategoryOption {
    slug: string;
    name: string;
}

interface ProductFiltersProps {
    sort: SortKey;
    minPrice?: string;
    maxPrice?: string;
    selectedCategory?: string;
    categories?: CategoryOption[];
    /** Otros searchParams que conservar en cada cambio (q, page, etc.). */
    preserve?: Record<string, string | undefined>;
    /**
     * Si la página vive bajo /category/[slug], el componente NO muestra el
     * selector de categoría. El padre lo controla con `hideCategory`.
     */
    hideCategory?: boolean;
}

/**
 * Bloque de filtros de listado: ordenación, rango de precio y categoría.
 * Los cambios se aplican navegando vía `router.push` (no submit) preservando
 * el resto de searchParams. La URL es la fuente de verdad — recargar mantiene
 * el estado, compartirla funciona.
 */
export default function ProductFilters({
    sort,
    minPrice,
    maxPrice,
    selectedCategory,
    categories = [],
    preserve = {},
    hideCategory = false
}: ProductFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [, startTransition] = useTransition();

    // Estados locales para el rango de precio: aplicamos sólo al pulsar el
    // botón; un onChange por keystroke dispararía navegaciones inútiles.
    const [minLocal, setMinLocal] = useState(minPrice ?? '');
    const [maxLocal, setMaxLocal] = useState(maxPrice ?? '');

    // Si los searchParams cambian desde fuera (back/forward del navegador,
    // navegación entre categorías), reflejamos los valores en los inputs.
    useEffect(() => { setMinLocal(minPrice ?? ''); }, [minPrice]);
    useEffect(() => { setMaxLocal(maxPrice ?? ''); }, [maxPrice]);

    const navigate = (changes: Record<string, string | null | undefined>) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(preserve)) {
            if (v) params.set(k, v);
        }
        // page se reinicia siempre que cambian los filtros: no tiene sentido
        // mantener "página 5" si el conjunto resultante es más pequeño.
        params.delete('page');

        // Aplicamos los cambios encima.
        for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === undefined || v === '') params.delete(k);
            else params.set(k, v);
        }

        const qs = params.toString();
        startTransition(() => {
            router.push(`${pathname}${qs ? `?${qs}` : ''}`);
        });
    };

    const applyPrice = () => {
        const min = minLocal.trim();
        const max = maxLocal.trim();
        navigate({ minPrice: min || null, maxPrice: max || null });
    };

    return (
        <aside
            aria-label="Filtros de productos"
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'flex-end',
                padding: '1.25rem',
                backgroundColor: 'var(--color-background-soft)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '2rem'
            }}
        >
            {/* Sort */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 180 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Ordenar por</span>
                <select
                    value={sort}
                    onChange={(e) => navigate({ sort: e.target.value })}
                    className="form-input"
                    style={{ padding: '0.5rem' }}
                >
                    <option value="newest">Novedades</option>
                    <option value="featured">Destacados primero</option>
                    <option value="price-asc">Precio: menor a mayor</option>
                    <option value="price-desc">Precio: mayor a menor</option>
                </select>
            </label>

            {/* Rango de precio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Precio (€)</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        placeholder="Min"
                        value={minLocal}
                        aria-label="Precio mínimo"
                        onChange={(e) => setMinLocal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyPrice(); }}
                        className="form-input"
                        style={{ width: 90, padding: '0.5rem' }}
                    />
                    <span aria-hidden>—</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        placeholder="Max"
                        value={maxLocal}
                        aria-label="Precio máximo"
                        onChange={(e) => setMaxLocal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyPrice(); }}
                        className="form-input"
                        style={{ width: 90, padding: '0.5rem' }}
                    />
                    <button type="button" onClick={applyPrice} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem' }}>
                        Aplicar
                    </button>
                </div>
            </div>

            {/* Categoría */}
            {!hideCategory && categories.length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 180 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Categoría</span>
                    <select
                        value={selectedCategory ?? ''}
                        onChange={(e) => navigate({ category: e.target.value || null })}
                        className="form-input"
                        style={{ padding: '0.5rem' }}
                    >
                        <option value="">Todas</option>
                        {categories.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                        ))}
                    </select>
                </label>
            )}

            {/* Limpiar */}
            {(sort !== 'newest' || minPrice || maxPrice || selectedCategory) && (
                <button
                    type="button"
                    onClick={() => {
                        setMinLocal('');
                        setMaxLocal('');
                        navigate({ sort: null, minPrice: null, maxPrice: null, category: null });
                    }}
                    className="btn"
                    style={{ padding: '0.5rem 0.75rem', background: 'transparent', textDecoration: 'underline', color: 'var(--color-text-secondary)' }}
                >
                    Limpiar filtros
                </button>
            )}
        </aside>
    );
}
