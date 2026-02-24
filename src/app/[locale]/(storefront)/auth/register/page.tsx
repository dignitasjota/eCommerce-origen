'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/storefront/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al registrar la cuenta.');
            }

            // Auto-login después del registro exitoso
            const signInResult = await signIn('credentials', {
                redirect: false,
                email,
                password,
                callbackUrl: '/account'
            });

            if (signInResult?.error) {
                // Registro bien, Login post-registro mal
                router.push('/auth/login?registered=true');
            } else {
                router.push('/account');
                router.refresh();
            }

        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '450px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Crear Cuenta</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Únete para guardar favoritos y agilizar tus compras.</p>
                </div>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    {error && (
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nombre completo</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input"
                            placeholder="Ej. Juan Pérez"
                            required
                            disabled={isLoading}
                            style={{ width: '100%' }}
                        />
                    </div>

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

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Contraseña</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            placeholder="Mínimo 6 caracteres"
                            required
                            disabled={isLoading}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Confirmar Contraseña</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input"
                            placeholder="Repite la contraseña..."
                            required
                            disabled={isLoading}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={isLoading}>
                        {isLoading ? 'Registrando...' : 'Crear Cuenta'}
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '1rem', lineHeight: '1.4' }}>
                        Al registrarte, aceptas nuestros <Link href="/legal/terms" style={{ textDecoration: 'underline' }}>Términos y Condiciones</Link> y <Link href="/legal/privacy" style={{ textDecoration: 'underline' }}>Política de Privacidad</Link>.
                    </div>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.95rem', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
                    ¿Ya tienes una cuenta? {' '}
                    <Link href="/auth/login" style={{ color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'underline' }}>
                        Inicia Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
}
