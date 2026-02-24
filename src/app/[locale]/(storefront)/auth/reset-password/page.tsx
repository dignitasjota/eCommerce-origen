'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    if (!token) {
        return (
            <div style={{ textAlign: 'center', color: 'var(--color-error)' }}>
                El enlace de recuperación es inválido o no existe.
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/storefront/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setTimeout(() => {
                    router.push('/auth/login');
                }, 3000);
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error inesperado de red.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>

            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                    backgroundColor: message.type === 'error' ? 'var(--color-error-soft)' : 'var(--color-success-soft)',
                    color: message.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
                    fontSize: '0.9rem',
                    textAlign: 'center'
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nueva Contraseña</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="Min. 6 caracteres"
                    required
                    disabled={isLoading || message?.type === 'success'}
                    style={{ width: '100%' }}
                />
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Confirmar Contraseña</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Repite la contraseña"
                    required
                    disabled={isLoading || message?.type === 'success'}
                    style={{ width: '100%' }}
                />
            </div>

            <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem' }}
                disabled={isLoading || message?.type === 'success'}
            >
                {isLoading ? 'Actualizando...' : 'Establecer nueva contraseña'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.95rem' }}>
                <Link href="/auth/login" style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline' }}>
                    Volver a Iniciar Sesión
                </Link>
            </div>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Nueva Contraseña</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Por favor, introduce tu nueva credencial de acceso para asegurar tu cuenta.</p>
                </div>

                <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando validación segura...</div>}>
                    <ResetPasswordForm />
                </Suspense>

            </div>
        </div>
    );
}
