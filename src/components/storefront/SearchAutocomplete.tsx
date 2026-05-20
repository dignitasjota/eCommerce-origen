'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

interface Result {
    id: string;
    slug: string;
    name: string;
    price: string;
    image: string | null;
}

interface SearchAutocompleteProps {
    placeholder: string;
    submitLabel: string;
    inputClassName?: string;
}

/**
 * Buscador del header con autocompletado debounced (250ms).
 *
 * - El submit clásico sigue funcionando: si el usuario pulsa enter, navega a
 *   `/products?q=...` con el término completo aunque no haya resultados.
 * - El popup se cierra con Escape o al hacer click fuera.
 * - El listado es navegable con ↑/↓/Enter (mejora notable de UX).
 */
export default function SearchAutocomplete({ placeholder, submitLabel, inputClassName }: SearchAutocompleteProps) {
    const router = useRouter();
    const locale = useLocale();

    const [q, setQ] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [loading, setLoading] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Debounce de 250ms para no saturar el endpoint con cada tecla.
    useEffect(() => {
        if (q.trim().length < 2) {
            setResults([]);
            setActiveIdx(-1);
            return;
        }
        const handle = setTimeout(async () => {
            // Cancelar fetch previo si llegan caracteres más nuevos.
            abortRef.current?.abort();
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            setLoading(true);
            try {
                const res = await fetch(
                    `/api/storefront/search?q=${encodeURIComponent(q.trim())}&locale=${locale}`,
                    { signal: ctrl.signal }
                );
                if (!res.ok) {
                    setResults([]);
                    return;
                }
                const data = await res.json();
                setResults(Array.isArray(data.results) ? data.results : []);
                setActiveIdx(-1);
            } catch {
                /* abort o red caída: silencio */
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(handle);
    }, [q, locale]);

    // Cerrar al click fuera.
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const goToFullSearch = () => {
        const term = q.trim();
        if (term) {
            router.push(`/products?q=${encodeURIComponent(term)}`);
            setOpen(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIdx((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(-1, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && results[activeIdx]) {
                router.push(`/product/${results[activeIdx].slug}`);
                setOpen(false);
                setQ('');
            } else {
                goToFullSearch();
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', flex: 1 }} role="combobox" aria-expanded={open && results.length > 0} aria-haspopup="listbox" aria-owns="search-listbox">
            <input
                type="search"
                name="q"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="search-listbox"
                aria-activedescendant={activeIdx >= 0 ? `search-result-${activeIdx}` : undefined}
                className={inputClassName}
                style={{ width: '100%' }}
                autoFocus
            />

            {open && (results.length > 0 || (q.trim().length >= 2 && !loading)) && (
                <ul
                    id="search-listbox"
                    role="listbox"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.4rem)',
                        left: 0,
                        right: 0,
                        background: 'var(--color-background)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                        listStyle: 'none',
                        margin: 0,
                        padding: '0.4rem 0',
                        zIndex: 100,
                        maxHeight: '70vh',
                        overflowY: 'auto'
                    }}
                >
                    {results.length === 0 ? (
                        <li style={{ padding: '0.75rem 1rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Sin resultados para “{q.trim()}”.
                        </li>
                    ) : (
                        results.map((r, i) => (
                            <li
                                key={r.id}
                                id={`search-result-${i}`}
                                role="option"
                                aria-selected={activeIdx === i}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // evita perder el blur antes de navegar
                                    router.push(`/product/${r.slug}`);
                                    setOpen(false);
                                    setQ('');
                                }}
                                onMouseEnter={() => setActiveIdx(i)}
                                style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    background: activeIdx === i ? 'var(--color-background-soft)' : 'transparent'
                                }}
                            >
                                <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0, background: 'var(--color-background-soft)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                    {r.image && (
                                        <Image src={r.image} alt={r.name} fill sizes="40px" style={{ objectFit: 'cover' }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {r.name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                        {r.price} €
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                    {results.length > 0 && (
                        <li style={{ borderTop: '1px solid var(--color-border)', padding: 0 }}>
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); goToFullSearch(); }}
                                style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.9rem' }}
                            >
                                {submitLabel} “{q.trim()}” →
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
