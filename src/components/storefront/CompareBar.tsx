'use client';

import { useCompare } from '@/context/CompareContext';
import { Link } from '@/i18n/navigation';

export default function CompareBar() {
    const { items, removeFromCompare, clearCompare } = useCompare();

    if (items.length === 0) return null;

    return (
        <div
            role="region"
            aria-label="Comparador de productos"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 900,
                backgroundColor: 'var(--color-background)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
                padding: '0.75rem 1rem'
            }}
        >
            <div
                className="container"
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
            >
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
                    {items.map((item) => (
                        <span
                            key={item.id}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'var(--color-background-soft)',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.85rem'
                            }}
                        >
                            {item.name}
                            <button
                                onClick={() => removeFromCompare(item.id)}
                                aria-label={`Quitar ${item.name} de comparar`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button className="btn btn-outline" onClick={clearCompare}>
                        Vaciar
                    </button>
                    <Link href="/compare" className="btn btn-primary">
                        Comparar ({items.length})
                    </Link>
                </div>
            </div>
        </div>
    );
}
