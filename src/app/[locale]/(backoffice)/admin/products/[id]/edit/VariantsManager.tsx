'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createVariant, updateVariant, deleteVariant } from './actions';

interface Variant {
    id: string;
    sku: string;
    price: number | null;
    stock: number;
    is_active: boolean;
}

interface Props {
    productId: string;
    productPrice: number;
    initialVariants: Variant[];
}

interface FormState {
    sku: string;
    price: string;
    stock: string;
    is_active: boolean;
}

const emptyForm: FormState = { sku: '', price: '', stock: '0', is_active: true };

/**
 * Editor plano de variantes de producto. CRUD individual con SKU/precio/stock
 * por variante. Sin combinatoria automática de opciones (pendiente de un
 * sprint posterior con UI de matriz). Reemplaza el hardcoding de
 * `product_variants[0]` que tenía el ProductsManager.
 *
 * Nota: si el producto tiene `unlimited_stock = true`, el stock por variante
 * se ignora en checkout. Aún así dejamos editarlo para que el admin pueda
 * cambiar el flag global y que el dato de stock no se pierda.
 */
export default function VariantsManager({ productId, productPrice, initialVariants }: Props) {
    const router = useRouter();
    const [editingId, setEditingId] = useState<string | 'new' | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startEdit = (v: Variant) => {
        setEditingId(v.id);
        setForm({
            sku: v.sku,
            price: v.price !== null ? String(v.price) : '',
            stock: String(v.stock),
            is_active: v.is_active
        });
        setError(null);
    };

    const startNew = () => {
        setEditingId('new');
        setForm(emptyForm);
        setError(null);
    };

    const cancel = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError(null);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        setBusy(true);
        setError(null);

        const payload = {
            sku: form.sku,
            price: form.price.trim() === '' ? null : form.price,
            stock: form.stock,
            is_active: form.is_active
        };

        const result = editingId === 'new'
            ? await createVariant(productId, payload)
            : await updateVariant(editingId, payload);

        setBusy(false);
        if (!result.success) {
            setError(result.error || 'Error');
            return;
        }
        cancel();
        router.refresh();
    };

    const onDelete = async (variantId: string) => {
        if (!confirm('¿Eliminar esta variante? Esta acción no se puede deshacer.')) return;
        setBusy(true);
        const result = await deleteVariant(variantId);
        setBusy(false);
        if (!result.success) {
            alert(result.error || 'Error');
            return;
        }
        router.refresh();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <table className="admin-table" style={{ marginBottom: 0 }}>
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th style={{ textAlign: 'right' }}>Precio</th>
                        <th style={{ textAlign: 'right' }}>Stock</th>
                        <th>Estado</th>
                        <th style={{ width: 160 }}></th>
                    </tr>
                </thead>
                <tbody>
                    {initialVariants.map((v) => (
                        <tr key={v.id}>
                            <td><code>{v.sku}</code></td>
                            <td style={{ textAlign: 'right' }}>
                                {v.price !== null
                                    ? `${v.price.toFixed(2)} €`
                                    : <span style={{ color: 'var(--color-text-tertiary)' }}>{productPrice.toFixed(2)} € (heredado)</span>}
                            </td>
                            <td style={{ textAlign: 'right' }}>{v.stock}</td>
                            <td>
                                <span className={`admin-badge ${v.is_active ? 'active' : 'inactive'}`}>
                                    {v.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => startEdit(v)} disabled={busy}>
                                    Editar
                                </button>{' '}
                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => onDelete(v.id)} disabled={busy} style={{ color: 'var(--color-danger)' }}>
                                    Borrar
                                </button>
                            </td>
                        </tr>
                    ))}
                    {initialVariants.length === 0 && (
                        <tr>
                            <td colSpan={5}>
                                <div className="admin-empty"><h3>El producto aún no tiene variantes.</h3></div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {editingId === null && (
                <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={startNew} style={{ alignSelf: 'flex-start' }}>
                    + Añadir variante
                </button>
            )}

            {editingId !== null && (
                <form onSubmit={onSubmit} className="admin-card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>SKU</span>
                        <input
                            type="text"
                            value={form.sku}
                            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                            required
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Precio (€) — vacío = heredar</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.price}
                            placeholder={productPrice.toFixed(2)}
                            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.8rem' }}>Stock</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={form.stock}
                            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                            required
                            className="admin-form-input"
                        />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'center' }}>
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.85rem' }}>Activa</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', gridColumn: '1 / -1' }}>
                        <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy}>
                            {busy ? 'Guardando…' : (editingId === 'new' ? 'Crear variante' : 'Guardar cambios')}
                        </button>
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={cancel} disabled={busy}>
                            Cancelar
                        </button>
                        {error && (
                            <span role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', alignSelf: 'center' }}>
                                {error}
                            </span>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
}
