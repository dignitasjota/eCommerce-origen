'use client';

import { useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { generateVariantMatrix } from './actions';

interface VariantOptionItem {
    id: string;
    slug: string;
    value: string;
}

interface VariantTypeItem {
    id: string;
    name: string;
    options: VariantOptionItem[];
}

export default function VariantMatrixGenerator({
    productId,
    productSku,
    variantTypes
}: {
    productId: string;
    productSku: string;
    variantTypes: VariantTypeItem[];
}) {
    const router = useRouter();
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
    const [open, setOpen] = useState(false);

    const toggleOption = (typeId: string, optionId: string) => {
        setSelected((prev) => {
            const current = new Set(prev[typeId] || []);
            if (current.has(optionId)) current.delete(optionId);
            else current.add(optionId);
            return { ...prev, [typeId]: current };
        });
    };

    const combinationCount = useMemo(() => {
        const counts = variantTypes.map((t) => (selected[t.id]?.size || 0)).filter((n) => n > 0);
        if (counts.length === 0) return 0;
        return counts.reduce((acc, n) => acc * n, 1);
    }, [selected, variantTypes]);

    const handleGenerate = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const selections = variantTypes
                .map((t) => ({ typeId: t.id, optionIds: Array.from(selected[t.id] || []) }))
                .filter((s) => s.optionIds.length > 0);

            const result = await generateVariantMatrix(productId, selections);
            if (!result.success) {
                setMessage({ text: result.error || 'Error al generar las variantes.', isError: true });
                return;
            }
            setMessage({
                text: `${result.created} variante${result.created === 1 ? '' : 's'} creada${result.created === 1 ? '' : 's'}${result.skipped > 0 ? ` · ${result.skipped} ya existía${result.skipped === 1 ? '' : 'n'}` : ''}.`,
                isError: false
            });
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="admin-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="admin-btn admin-btn-secondary admin-btn-sm"
                style={{ marginBottom: open ? '1rem' : 0 }}
            >
                {open ? 'Ocultar generador de matriz' : 'Generar variantes por combinación (matriz)'}
            </button>

            {open && (
                <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        Marca los valores de cada atributo que aplican a este producto. Se creará una variante por
                        cada combinación (SKU auto-generado a partir de <code>{productSku}</code>), con stock 0 y
                        precio heredado — edítalos después en la tabla de abajo. Las combinaciones que ya existan no
                        se duplican.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                        {variantTypes.map((type) => (
                            <div key={type.id}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>{type.name}</div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {type.options.length === 0 ? (
                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>Sin valores definidos.</span>
                                    ) : (
                                        type.options.map((opt) => {
                                            const checked = selected[type.id]?.has(opt.id) || false;
                                            return (
                                                <label
                                                    key={opt.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        padding: '0.3rem 0.6rem',
                                                        borderRadius: 'var(--radius-full)',
                                                        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                        backgroundColor: checked ? 'var(--color-primary-light)' : 'transparent',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <input type="checkbox" checked={checked} onChange={() => toggleOption(type.id, opt.id)} style={{ margin: 0 }} />
                                                    {opt.value}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            type="button"
                            className="admin-btn admin-btn-primary admin-btn-sm"
                            onClick={handleGenerate}
                            disabled={busy || combinationCount === 0}
                        >
                            {busy ? 'Generando…' : `Generar ${combinationCount || ''} variante${combinationCount === 1 ? '' : 's'}`}
                        </button>
                        {message && (
                            <span role="status" style={{ fontSize: '0.85rem', color: message.isError ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {message.text}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
