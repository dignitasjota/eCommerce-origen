'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';

interface ItemInput {
    id: string;
    name: string;
    sku: string;
    max: number;
    price: number;
}

interface Props {
    orderId: string;
    items: ItemInput[];
}

interface SelectedItem {
    quantity: number;
    condition: 'UNOPENED' | 'OPENED' | 'DAMAGED' | 'USED';
    reason: string;
}

const CONDITIONS: { value: SelectedItem['condition']; label: string }[] = [
    { value: 'UNOPENED', label: 'Sin abrir' },
    { value: 'OPENED', label: 'Abierto pero no usado' },
    { value: 'USED', label: 'Usado' },
    { value: 'DAMAGED', label: 'Dañado / defectuoso' }
];

export default function ReturnRequestForm({ orderId, items }: Props) {
    const router = useRouter();
    const [reason, setReason] = useState('');
    const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (id: string, max: number) => {
        setSelected((prev) => {
            if (prev[id]) {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            }
            return { ...prev, [id]: { quantity: 1, condition: 'UNOPENED', reason: '' } };
        });
    };

    const update = (id: string, patch: Partial<SelectedItem>) => {
        setSelected((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const itemsArr = Object.entries(selected).map(([order_item_id, s]) => ({
            order_item_id,
            quantity: s.quantity,
            condition: s.condition,
            reason: s.reason || null
        }));
        if (itemsArr.length === 0) {
            setError('Selecciona al menos un producto');
            return;
        }

        setBusy(true);
        try {
            const res = await fetch('/api/storefront/returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, reason, items: itemsArr })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo procesar');
                setBusy(false);
                return;
            }
            // Éxito → volver al listado con flag para mostrar mensaje de éxito
            router.push(`/account/orders?return=${data.return_number}`);
        } catch {
            setError('Error de conexión');
            setBusy(false);
        }
    };

    const totalEstimate = Object.entries(selected).reduce((acc, [id, s]) => {
        const item = items.find((i) => i.id === id);
        return acc + (item ? item.price * s.quantity : 0);
    }, 0);

    return (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>
                    ¿Por qué quieres devolverlo? *
                </label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    required
                    minLength={5}
                    maxLength={1000}
                    placeholder="Cuéntanos brevemente el motivo (mín. 5 caracteres)…"
                    className="form-input"
                    style={{ width: '100%' }}
                />
            </div>

            <div>
                <h2 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Productos a devolver *</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    Marca los que quieres devolver y ajusta la cantidad.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {items.map((it) => {
                        const isSelected = !!selected[it.id];
                        const sel = selected[it.id];
                        return (
                            <div
                                key={it.id}
                                style={{
                                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    background: isSelected ? 'var(--color-background-soft)' : 'transparent',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1rem',
                                    transition: 'border-color 0.15s'
                                }}
                            >
                                <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggle(it.id, it.max)}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                                            SKU: <code>{it.sku}</code> · {it.price.toFixed(2)} € · disponible para devolver: {it.max}
                                        </div>
                                    </div>
                                </label>

                                {isSelected && (
                                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
                                            Cantidad
                                            <input
                                                type="number"
                                                min={1}
                                                max={it.max}
                                                value={sel.quantity}
                                                onChange={(e) =>
                                                    update(it.id, { quantity: Math.min(it.max, Math.max(1, parseInt(e.target.value) || 1)) })
                                                }
                                                className="form-input"
                                            />
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
                                            Estado
                                            <select
                                                value={sel.condition}
                                                onChange={(e) => update(it.id, { condition: e.target.value as SelectedItem['condition'] })}
                                                className="form-input"
                                            >
                                                {CONDITIONS.map((c) => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {totalEstimate > 0 && (
                <div style={{ padding: '1rem', background: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', textAlign: 'right' }}>
                    Reembolso estimado: <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                        {totalEstimate.toFixed(2)} €
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.25rem' }}>
                        Importe orientativo. El reembolso definitivo lo confirmará la tienda al revisar la mercancía.
                    </div>
                </div>
            )}

            {error && (
                <div role="alert" style={{ background: 'var(--color-danger)', color: 'white', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={busy || Object.keys(selected).length === 0 || reason.trim().length < 5}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start', padding: '0.75rem 1.5rem' }}
            >
                {busy ? 'Enviando…' : 'Enviar solicitud de devolución'}
            </button>
        </form>
    );
}
