'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Suspense } from 'react';

function LoginFormContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/account';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await signIn('credentials', {
                redirect: false,
                email,
                password,
                callbackUrl
            });

            if (res?.error) {
                setError('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
                setIsLoading(false);
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (err) {
            setError('Ha ocurrido un error inesperado. Inténtalo más tarde.');
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {error && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Correo Electrónico</label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="tucorreo@ejemplo.com"
                    required
                    disabled={isLoading}
                    style={{ width: '100%' }}
                />
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label htmlFor="password" style={{ fontWeight: '500' }}>Contraseña</label>
                    <Link href="/auth/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>
                        ¿Has olvidado tu contraseña?
                    </Link>
                </div>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    style={{ width: '100%' }}
                />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={isLoading}>
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
        </form>
    );
}

export default function LoginPage() {
    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Bienvenido</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Inicia sesión para acceder a tu cuenta.</p>
                </div>

                <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem' }}>Cargando formulario...</div>}>
                    <LoginFormContent />
                </Suspense>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>
                    ¿No tienes una cuenta? {' '}
                    <Link href="/auth/register" style={{ color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'underline' }}>
                        Regístrate
                    </Link>
                </div>
            </div>
        </div>
    );
}
