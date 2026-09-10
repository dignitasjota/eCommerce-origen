'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createVariantType, deleteVariantType, createVariantOption, deleteVariantOption } from './actions';

interface VariantOptionItem {
    id: string;
    slug: string;
    value: string;
}

interface VariantTypeItem {
    id: string;
    slug: string;
    name: string;
    options: VariantOptionItem[];
}

export default function AttributesManager({ initialTypes }: { initialTypes: VariantTypeItem[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newOptionValue, setNewOptionValue] = useState<Record<string, string>>({});

    const handleCreateType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTypeName.trim()) return;
        setBusy(true);
        try {
            const fd = new FormData();
            fd.set('name', newTypeName);
            const result = await createVariantType(fd);
            if (!result.success) {
                alert(result.error);
                return;
            }
            setNewTypeName('');
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteType = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar el atributo "${name}" y todos sus valores? Esta acción no se puede deshacer.`)) return;
        setBusy(true);
        try {
            const result = await deleteVariantType(id);
            if (!result.success) alert(result.error);
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const handleCreateOption = async (typeId: string, e: React.FormEvent) => {
        e.preventDefault();
        const value = (newOptionValue[typeId] || '').trim();
        if (!value) return;
        setBusy(true);
        try {
            const fd = new FormData();
            fd.set('value', value);
            const result = await createVariantOption(typeId, fd);
            if (!result.success) {
                alert(result.error);
                return;
            }
            setNewOptionValue((prev) => ({ ...prev, [typeId]: '' }));
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteOption = async (id: string, value: string) => {
        if (!window.confirm(`¿Eliminar el valor "${value}"?`)) return;
        setBusy(true);
        try {
            const result = await deleteVariantOption(id);
            if (!result.success) alert(result.error);
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Atributos de Variantes</h1>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', maxWidth: '700px' }}>
                Define aquí los atributos compartidos entre productos (Color, Talla…) y sus valores posibles. Luego,
                desde la ficha de cada producto, podrás generar automáticamente todas las combinaciones de variantes
                (matriz combinatoria) a partir de estos valores.
            </p>

            <form onSubmit={handleCreateType} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <input
                    type="text"
                    className="admin-form-input"
                    placeholder="Nuevo atributo (ej: Color)"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    style={{ maxWidth: '300px' }}
                    disabled={busy}
                />
                <button type="submit" className="admin-btn admin-btn-primary" disabled={busy || !newTypeName.trim()}>
                    + Añadir atributo
                </button>
            </form>

            {initialTypes.length === 0 ? (
                <div className="admin-empty">
                    <h3>Aún no hay atributos definidos.</h3>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {initialTypes.map((type) => (
                        <div key={type.id} className="admin-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{type.name}</h3>
                                <button
                                    type="button"
                                    className="admin-btn admin-btn-secondary admin-btn-sm"
                                    style={{ color: 'var(--color-danger)' }}
                                    onClick={() => handleDeleteType(type.id, type.name)}
                                    disabled={busy}
                                >
                                    Eliminar atributo
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {type.options.length === 0 ? (
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>Sin valores todavía.</span>
                                ) : (
                                    type.options.map((opt) => (
                                        <span
                                            key={opt.id}
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
                                            {opt.value}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteOption(opt.id, opt.value)}
                                                aria-label={`Eliminar ${opt.value}`}
                                                disabled={busy}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>

                            <form onSubmit={(e) => handleCreateOption(type.id, e)} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Nuevo valor (ej: Rojo)"
                                    value={newOptionValue[type.id] || ''}
                                    onChange={(e) => setNewOptionValue((prev) => ({ ...prev, [type.id]: e.target.value }))}
                                    disabled={busy}
                                />
                                <button type="submit" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busy || !(newOptionValue[type.id] || '').trim()}>
                                    Añadir
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
