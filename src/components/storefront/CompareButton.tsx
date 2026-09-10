'use client';

import { useCompare, type CompareItem } from '@/context/CompareContext';
import { MAX_COMPARE_ITEMS } from '@/lib/compare';

export default function CompareButton({ product, className = '' }: { product: CompareItem; className?: string }) {
    const { isInCompare, toggleCompare } = useCompare();
    const active = isInCompare(product.id);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault(); // Evitar navegación si está dentro de un <Link>
        e.stopPropagation();
        const result = toggleCompare(product);
        if (!result.added && result.reason === 'limit') {
            alert(`Sólo puedes comparar hasta ${MAX_COMPARE_ITEMS} productos a la vez. Quita alguno antes de añadir otro.`);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`compare-btn ${className}`}
            style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            aria-pressed={active}
            aria-label={active ? 'Quitar de comparar' : 'Añadir a comparar'}
            title={active ? 'Quitar de comparar' : 'Añadir a comparar'}
        >
            <svg
                aria-hidden="true"
                focusable="false"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={active ? 'var(--color-primary)' : 'none'}
                stroke={active ? 'var(--color-primary)' : 'currentColor'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="12" rx="1" />
            </svg>
        </button>
    );
}
