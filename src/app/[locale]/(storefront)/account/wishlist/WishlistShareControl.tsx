'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { generateWishlistShareLink, revokeWishlistShareLink } from './actions';

export default function WishlistShareControl({ initialToken }: { initialToken: string | null }) {
    const router = useRouter();
    const [token, setToken] = useState(initialToken);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const shareUrl = token && typeof window !== 'undefined' ? `${window.location.origin}/wishlist/${token}` : '';

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await generateWishlistShareLink();
            if (result.success) {
                setToken(result.token);
                router.refresh();
            } else {
                setError(result.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('No se pudo copiar el enlace. Cópialo manualmente.');
        }
    };

    const handleRevoke = async () => {
        if (!window.confirm('¿Desactivar el enlace? Dejará de funcionar para cualquiera que lo tenga.')) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await revokeWishlistShareLink();
            if (result.success) {
                setToken(null);
                router.refresh();
            } else {
                setError(result.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
            {error && (
                <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
            )}
            {!token ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                        Comparte tu lista de deseos con un enlace público para que otros vean qué te gustaría recibir.
                    </p>
                    <button className="btn btn-outline" onClick={handleGenerate} disabled={isLoading}>
                        {isLoading ? 'Generando…' : 'Compartir esta lista'}
                    </button>
                </div>
            ) : (
                <div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '0.75rem' }}>
                        Cualquiera con este enlace puede ver tu lista de deseos (sin tus datos personales):
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            onFocus={(e) => e.target.select()}
                            style={{ flex: '1 1 260px', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                        />
                        <button className="btn btn-outline" onClick={handleCopy} disabled={!shareUrl}>
                            {copied ? '¡Copiado!' : 'Copiar enlace'}
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                            onClick={handleRevoke}
                            disabled={isLoading}
                        >
                            Desactivar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
