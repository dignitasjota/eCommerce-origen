'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { approveReturn, rejectReturn, markReturnReceived, refundReturn } from '../actions';

interface Props {
    returnId: string;
    status: string;
    suggestedRefund: number;
    isStripe: boolean;
}

/**
 * Panel de acciones del admin sobre una devolución.
 *
 * Muestra sólo las acciones permitidas según el estado actual:
 *   - REQUESTED  → Aprobar / Rechazar
 *   - APPROVED   → Marcar recibida (con tracking)
 *   - RECEIVED   → Reembolsar (con importe editable)
 *   - REJECTED/REFUNDED/CANCELLED → sólo lectura
 */
export default function ReturnManagerForm({ returnId, status, suggestedRefund, isStripe }: Props) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async (
        action: (id: string, fd: FormData) => Promise<{ success: boolean; error?: string }>,
        formData: FormData
    ) => {
        setBusy(true);
        setError(null);
        const result = await action(returnId, formData);
        setBusy(false);
        if (!result.success) {
            setError(result.error || 'Error');
            return;
        }
        router.refresh();
    };

    return (
        <div className="admin-table-container" style={{ padding: '1.25rem', position: 'sticky', top: '1rem' }}>
            <h2 className="admin-table-title">Acciones</h2>

            {error && (
                <div role="alert" style={{ background: 'var(--color-danger)', color: 'white', padding: '0.6rem 0.8rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    {error}
                </div>
            )}

            {status === 'REQUESTED' && (
                <>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(approveReturn, new FormData(e.currentTarget));
                        }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}
                    >
                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aprobar devolución</label>
                        <textarea
                            name="admin_notes"
                            className="admin-form-input"
                            rows={3}
                            placeholder="Notas para el cliente (opcional, ej. dirección de envío del retorno)…"
                        />
                        <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-sm">
                            {busy ? '…' : '✓ Aprobar'}
                        </button>
                    </form>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(rejectReturn, new FormData(e.currentTarget));
                        }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rechazar devolución</label>
                        <textarea
                            name="admin_notes"
                            className="admin-form-input"
                            rows={3}
                            placeholder="Motivo del rechazo (obligatorio)…"
                            required
                        />
                        <button type="submit" disabled={busy} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ color: 'var(--color-danger)' }}>
                            ✗ Rechazar
                        </button>
                    </form>
                </>
            )}

            {status === 'APPROVED' && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        run(markReturnReceived, new FormData(e.currentTarget));
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                >
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Marcar mercancía recibida
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        Se restituirá el stock automáticamente y se notificará al cliente.
                    </p>
                    <input
                        name="tracking_number"
                        className="admin-form-input"
                        placeholder="Tracking del envío (opcional)"
                    />
                    <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-sm">
                        {busy ? '…' : '📦 Recibida'}
                    </button>
                </form>
            )}

            {status === 'RECEIVED' && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!confirm(isStripe
                            ? '¿Procesar reembolso real en Stripe? El dinero se devolverá al cliente.'
                            : '¿Marcar como reembolsada? Recuerda hacer la transferencia manualmente.')) return;
                        run(refundReturn, new FormData(e.currentTarget));
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                >
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Procesar reembolso</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {isStripe
                            ? '✓ Pago con Stripe — el reembolso se ejecutará vía API.'
                            : '⚠ Pago externo (COD/transferencia) — esta acción sólo registra el importe; ejecuta la transferencia manualmente.'}
                    </p>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        name="refund_amount"
                        className="admin-form-input"
                        defaultValue={suggestedRefund.toFixed(2)}
                        required
                    />
                    <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-sm">
                        {busy ? '…' : '💰 Reembolsar'}
                    </button>
                </form>
            )}

            {(status === 'REJECTED' || status === 'REFUNDED' || status === 'CANCELLED') && (
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                    Esta devolución está cerrada. No hay acciones disponibles.
                </p>
            )}
        </div>
    );
}
