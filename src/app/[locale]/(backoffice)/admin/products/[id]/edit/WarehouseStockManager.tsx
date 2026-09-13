'use client';

import { useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { updateVariantWarehouseStock } from './actions';

interface WarehouseCol {
    id: string;
    name: string;
    is_active: boolean;
    is_dropshipping: boolean;
}

interface VariantRow {
    id: string;
    sku: string;
    /** stock por warehouse_id, sólo de las filas que ya existen en WarehouseStock. */
    stockByWarehouse: Record<string, number>;
}

interface Props {
    warehouses: WarehouseCol[];
    variants: VariantRow[];
}

/**
 * Matriz "variante × almacén" para editar el desglose real de stock. Es la
 * fuente de verdad desde que existe multi-warehouse — el editor plano de
 * `VariantsManager` sólo muestra el total cacheado (suma de estas filas).
 *
 * Los almacenes de drop shipping se muestran igualmente (para que el admin
 * vea que la variante está disponible por ese canal) pero su celda es de
 * sólo lectura: no tienen contador local — capacidad virtual gestionada por
 * el proveedor externo (ver ADR de multi-warehouse).
 */
export default function WarehouseStockManager({ warehouses, variants }: Props) {
    const router = useRouter();
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const physicalWarehouses = useMemo(() => warehouses.filter((w) => w.is_active), [warehouses]);

    const startEdit = (variant: VariantRow) => {
        setEditingVariantId(variant.id);
        const next: Record<string, string> = {};
        for (const wh of physicalWarehouses) {
            if (wh.is_dropshipping) continue;
            next[wh.id] = String(variant.stockByWarehouse[wh.id] ?? 0);
        }
        setDraft(next);
        setError(null);
    };

    const cancel = () => {
        setEditingVariantId(null);
        setDraft({});
        setError(null);
    };

    const onSave = async (variant: VariantRow) => {
        setBusy(true);
        setError(null);

        const values: { warehouseId: string; newStock: number }[] = [];
        for (const [warehouseId, raw] of Object.entries(draft)) {
            const n = parseInt(raw, 10);
            if (!Number.isInteger(n) || n < 0) {
                setBusy(false);
                setError('Todos los valores de stock deben ser números enteros ≥ 0.');
                return;
            }
            values.push({ warehouseId, newStock: n });
        }
        const previousValues: Record<string, number> = {};
        for (const wh of physicalWarehouses) {
            if (wh.is_dropshipping) continue;
            previousValues[wh.id] = variant.stockByWarehouse[wh.id] ?? 0;
        }

        const result = await updateVariantWarehouseStock(variant.id, values, previousValues);
        setBusy(false);
        if (!result.success) {
            setError(result.error || 'Error guardando el stock');
            return;
        }
        cancel();
        router.refresh();
    };

    if (warehouses.length === 0) {
        return (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                No hay almacenes configurados todavía.
            </p>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ marginBottom: 0 }}>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            {warehouses.map((wh) => (
                                <th key={wh.id} style={{ textAlign: 'right' }}>
                                    {wh.name}
                                    {wh.is_dropshipping && (
                                        <span style={{ display: 'block', fontWeight: 400, fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>
                                            drop shipping
                                        </span>
                                    )}
                                    {!wh.is_active && (
                                        <span style={{ display: 'block', fontWeight: 400, fontSize: '0.7rem', color: 'var(--color-danger)' }}>
                                            inactivo
                                        </span>
                                    )}
                                </th>
                            ))}
                            <th style={{ width: 140 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {variants.map((v) => {
                            const isEditing = editingVariantId === v.id;
                            return (
                                <tr key={v.id}>
                                    <td><code>{v.sku}</code></td>
                                    {warehouses.map((wh) => {
                                        if (wh.is_dropshipping) {
                                            return (
                                                <td key={wh.id} style={{ textAlign: 'right', color: 'var(--color-text-tertiary)' }}>
                                                    {v.stockByWarehouse[wh.id] !== undefined ? '∞' : '—'}
                                                </td>
                                            );
                                        }
                                        return (
                                            <td key={wh.id} style={{ textAlign: 'right' }}>
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={draft[wh.id] ?? '0'}
                                                        onChange={(e) => setDraft((d) => ({ ...d, [wh.id]: e.target.value }))}
                                                        className="admin-form-input"
                                                        style={{ width: '5.5rem', textAlign: 'right' }}
                                                        disabled={busy || !wh.is_active}
                                                    />
                                                ) : (
                                                    v.stockByWarehouse[wh.id] ?? 0
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'right' }}>
                                        {isEditing ? (
                                            <>
                                                <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => onSave(v)} disabled={busy}>
                                                    {busy ? 'Guardando…' : 'Guardar'}
                                                </button>{' '}
                                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={cancel} disabled={busy}>
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => startEdit(v)} disabled={editingVariantId !== null}>
                                                Editar stock
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {variants.length === 0 && (
                            <tr>
                                <td colSpan={warehouses.length + 2}>
                                    <div className="admin-empty"><h3>El producto aún no tiene variantes.</h3></div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {error && (
                <span role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                    {error}
                </span>
            )}
        </div>
    );
}
