'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/storefront/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setIsSubmitted(true);
            } else {
                console.error("No se pudo enviar el correo o email inválido");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>

                {isSubmitted ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', marginBottom: '1.5rem' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Revisa tu correo</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
                            Te hemos enviado instrucciones sobre cómo restablecer tu contraseña a <strong>{email}</strong>.
                        </p>
                        <Link href="/auth/login" className="btn btn-primary" style={{ width: '100%', display: 'inline-block' }}>
                            Volver a Iniciar Sesión
                        </Link>
                    </div>
                ) : (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Recuperar Contraseña</h1>
                            <p style={{ color: 'var(--color-text-secondary)' }}>Introduce tu correo y te enviaremos un enlace para restablecerla.</p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                            <div style={{ marginBottom: '2rem' }}>
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

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem' }} disabled={isLoading}>
                                {isLoading ? 'Enviando...' : 'Enviar instrucciones'}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>
                            <Link href="/auth/login" style={{ color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                                Volver a Iniciar Sesión
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
