'use client';

import { useState } from 'react';
import { redeemPoints } from './actions';

interface Transaction {
    id: string;
    type: 'EARN' | 'REDEEM' | 'REVERSAL';
    points: number;
    note: string | null;
    created_at: string;
}

const TYPE_LABELS: Record<Transaction['type'], string> = {
    EARN: 'Puntos ganados',
    REDEEM: 'Canje',
    REVERSAL: 'Ajuste por reembolso'
};

export default function LoyaltyManager({
    balance,
    transactions,
    pointValueCents
}: {
    balance: number;
    transactions: Transaction[];
    pointValueCents: number;
}) {
    const [points, setPoints] = useState(100);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ code: string; discount: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const previewDiscount = ((points * pointValueCents) / 100).toFixed(2);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const fd = new FormData();
            fd.set('points', String(points));
            const res = await redeemPoints(fd);
            if (res.success) {
                setResult({ code: res.code, discount: res.discount });
            } else {
                setError(res.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard no disponible — el código sigue visible para copiarlo a mano.
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>Mis Puntos de Fidelización</h1>

            <div
                style={{
                    padding: '2rem',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '2rem'
                }}
            >
                <p style={{ opacity: 0.85, marginBottom: '0.5rem' }}>Saldo actual</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{balance} pts</p>
                <p style={{ opacity: 0.85, marginTop: '0.5rem' }}>
                    Equivalente a {((balance * pointValueCents) / 100).toFixed(2)} € en descuento si los canjeas todos.
                </p>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Canjear puntos por un cupón</h2>

                {result ? (
                    <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-success-soft, #ecfdf5)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ color: 'var(--color-success, #047857)', fontWeight: 600, marginBottom: '0.75rem' }}>
                            ¡Cupón generado por {result.discount} € de descuento!
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <code style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>
                                {result.code}
                            </code>
                            <button type="button" className="btn btn-outline" onClick={handleCopy}>
                                {copied ? '¡Copiado!' : 'Copiar código'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.75rem' }}>
                            Introduce este código en el campo de cupón durante el checkout. Es de un solo uso.
                        </p>
                        <button type="button" className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => setResult(null)}>
                            Canjear más puntos
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                            <label htmlFor="points-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                                Puntos a canjear
                            </label>
                            <input
                                id="points-input"
                                type="number"
                                min={1}
                                max={balance}
                                value={points}
                                onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value, 10) || 0))}
                                style={{ padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', width: '140px' }}
                            />
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.7rem' }}>= {previewDiscount} € de descuento</p>
                        <button type="submit" className="btn btn-primary" disabled={isLoading || balance === 0 || points > balance}>
                            {isLoading ? 'Canjeando…' : 'Generar cupón'}
                        </button>
                    </form>
                )}

                {error && (
                    <p role="alert" style={{ color: 'var(--color-danger)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                        {error}
                    </p>
                )}
                {balance === 0 && !result && (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                        Aún no tienes puntos. Se otorgan automáticamente al completarse el pago de un pedido.
                    </p>
                )}
            </div>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Historial</h2>
            {transactions.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>Todavía no hay movimientos.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {transactions.map((t) => (
                        <div
                            key={t.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                backgroundColor: 'var(--color-background-soft)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>{TYPE_LABELS[t.type]}</div>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                                    {new Date(t.created_at).toLocaleDateString('es-ES')}
                                    {t.note ? ` · ${t.note}` : ''}
                                </div>
                            </div>
                            <div style={{ fontWeight: 'bold', color: t.points >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {t.points >= 0 ? '+' : ''}
                                {t.points} pts
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
