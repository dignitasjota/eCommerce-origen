'use client';

import { useState } from 'react';
import { updateOrderFullStatus } from '../actions';
import { useRouter } from 'next/navigation';

interface OrderManagerProps {
    orderId: string;
    currentStatus: string;
    currentPaymentStatus: string;
    statusLabels: Record<string, string>;
    paymentLabels: Record<string, string>;
}

export default function OrderManagerForm({ orderId, currentStatus, currentPaymentStatus, statusLabels, paymentLabels }: OrderManagerProps) {
    const router = useRouter();
    const [status, setStatus] = useState(currentStatus);
    const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append('orderId', orderId);
            formData.append('status', status);
            formData.append('paymentStatus', paymentStatus);

            const result = await updateOrderFullStatus(formData);

            if (result.success) {
                setMessage({ type: 'success', text: 'Pedido actualizado correctamente.' });
                router.refresh();
            } else {
                setMessage({ type: 'error', text: result.error || 'Error desconocido' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Error de conexión: ' + err.message });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {message && (
                <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#15803d' : '#b91c1c', border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                    {message.text}
                </div>
            )}

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    Estado del Pedido (El cambio notificará al cliente)
                </label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-form-select">
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    Estado del Pago
                </label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="admin-form-select">
                    {Object.entries(paymentLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            <button type="submit" disabled={isLoading} className="admin-btn admin-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
                {isLoading ? 'Actualizando...' : 'Actualizar Pedido'}
            </button>
        </form>
    );
}
