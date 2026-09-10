'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useCompare } from '@/context/CompareContext';
import AddToCartClientButton from '@/components/storefront/AddToCartClientButton';

interface CompareProduct {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    price: string;
    compareAtPrice: string | null;
    sku: string;
    weight: number | null;
    dimensions: string | null;
    categories: string | null;
    availability: string;
    avgRating: number | null;
    reviewCount: number;
}

function formatDimensions(raw: string | null): string | null {
    if (!raw) return null;
    try {
        const d = JSON.parse(raw) as { w?: number; h?: number; d?: number };
        if (!d.w && !d.h && !d.d) return null;
        return `${d.w ?? '–'} × ${d.h ?? '–'} × ${d.d ?? '–'} cm`;
    } catch {
        return null;
    }
}

export default function ComparePage() {
    const { items, removeFromCompare, clearCompare } = useCompare();
    const locale = useLocale();
    const [products, setProducts] = useState<CompareProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        // Todo el trabajo (incluida la rama "lista vacía") vive dentro de este
        // IIFE async para que ningún setState se dispare de forma síncrona en
        // el cuerpo del efecto — el endpoint ya devuelve `products: []` si
        // `ids` viene vacío, así que no hace falta una rama especial.
        (async () => {
            setIsLoading(true);
            try {
                const ids = items.map((i) => i.id).join(',');
                const res = await fetch(`/api/storefront/compare?ids=${ids}&locale=${locale}`);
                const data = await res.json();
                if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);
            } catch {
                if (!cancelled) setProducts([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [items, locale]);

    const rows: { label: string; render: (p: CompareProduct) => React.ReactNode }[] = [
        {
            label: 'Precio',
            render: (p) => (
                <span>
                    <strong style={{ color: 'var(--color-primary)' }}>{p.price} €</strong>
                    {p.compareAtPrice && (
                        <span style={{ marginLeft: '0.5rem', textDecoration: 'line-through', color: 'var(--color-text-tertiary)' }}>
                            {p.compareAtPrice} €
                        </span>
                    )}
                </span>
            )
        },
        {
            label: 'Valoración',
            render: (p) => (p.avgRating !== null ? `${p.avgRating.toFixed(1)} / 5 (${p.reviewCount})` : 'Sin reseñas')
        },
        {
            label: 'Disponibilidad',
            render: (p) => (
                <span style={{ color: p.availability === 'En stock' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {p.availability}
                </span>
            )
        },
        { label: 'Categoría', render: (p) => p.categories || '—' },
        { label: 'SKU', render: (p) => p.sku },
        { label: 'Peso', render: (p) => (p.weight ? `${p.weight} kg` : '—') },
        { label: 'Dimensiones', render: (p) => formatDimensions(p.dimensions) || '—' },
        { label: 'Descripción', render: (p) => p.description || '—' }
    ];

    return (
        <div className="container" style={{ padding: '4rem 1rem', paddingBottom: '8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Comparar productos</h1>
                {products.length > 0 && (
                    <button className="btn btn-outline" onClick={clearCompare}>
                        Vaciar comparación
                    </button>
                )}
            </div>

            {isLoading ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>Cargando…</p>
            ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <h2>No tienes productos para comparar</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                        Pulsa el icono de comparar en cualquier producto del catálogo para añadirlo aquí.
                    </p>
                    <Link href="/products" className="btn btn-primary" style={{ marginTop: '2rem' }}>
                        Ir al catálogo
                    </Link>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${products.length * 220}px` }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.75rem', width: '140px' }} />
                                {products.map((p) => (
                                    <th key={p.id} style={{ padding: '0.75rem', verticalAlign: 'top', minWidth: '220px' }}>
                                        <div style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
                                            {p.image && (
                                                <Image src={p.image} alt={p.name} fill sizes="220px" style={{ objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                                            )}
                                        </div>
                                        <Link href={`/product/${p.slug}`} style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.75rem' }}>
                                            {p.name}
                                        </Link>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <AddToCartClientButton product={{ id: p.id, name: p.name, price: p.price, image: p.image || undefined }} />
                                            <button
                                                className="btn btn-outline"
                                                style={{ width: '100%' }}
                                                onClick={() => removeFromCompare(p.id)}
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} style={{ borderTop: '1px solid var(--color-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', verticalAlign: 'top' }}>
                                        {row.label}
                                    </th>
                                    {products.map((p) => (
                                        <td key={p.id} style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                            {row.render(p)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
