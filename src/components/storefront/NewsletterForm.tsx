'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';

interface NewsletterFormProps {
    inputClassName?: string;
    buttonClassName?: string;
    placeholder?: string;
    submitLabel?: string;
}

/**
 * Formulario del home que da de alta en la newsletter (doble opt-in).
 *
 * UX:
 *   - Estados: idle / submitting / success / error.
 *   - Si el usuario aterriza en `/?newsletter=confirmed|already|invalid`
 *     (vuelta del email de confirmación), mostramos un mensaje persistente y
 *     limpiamos el query param sin recargar.
 */
export default function NewsletterForm({
    inputClassName,
    buttonClassName,
    placeholder = 'tu@email.com',
    submitLabel = 'Suscribirse'
}: NewsletterFormProps) {
    const locale = useLocale();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');

    // Detectar query param de la confirmación.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        const param = url.searchParams.get('newsletter');
        if (!param) return;

        if (param === 'confirmed') {
            setStatus('success');
            setMessage('¡Suscripción confirmada! Recibirás nuestras novedades en breve.');
        } else if (param === 'already') {
            setStatus('success');
            setMessage('Tu suscripción ya estaba confirmada.');
        } else if (param === 'invalid') {
            setStatus('error');
            setMessage('El enlace de confirmación no es válido o ha expirado.');
        }

        // Limpiar el query param para no repetir el mensaje al recargar.
        url.searchParams.delete('newsletter');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }, []);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (status === 'submitting') return;
        const trimmed = email.trim();
        if (!trimmed) return;

        setStatus('submitting');
        setMessage('');
        try {
            const res = await fetch('/api/storefront/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed, locale })
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'No se pudo procesar la solicitud.');
                return;
            }
            setStatus('success');
            setMessage(data.message || 'Te hemos enviado un correo para confirmar la suscripción.');
            setEmail('');
        } catch {
            setStatus('error');
            setMessage('Hubo un problema de conexión. Inténtalo de nuevo.');
        }
    };

    return (
        <form onSubmit={onSubmit} aria-live="polite">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={placeholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClassName}
                    aria-label={placeholder}
                    disabled={status === 'submitting'}
                />
                <button
                    type="submit"
                    className={buttonClassName || 'btn btn-primary btn-lg'}
                    disabled={status === 'submitting'}
                >
                    {status === 'submitting' ? 'Enviando…' : submitLabel}
                </button>
            </div>

            {message && (
                <p
                    role={status === 'error' ? 'alert' : 'status'}
                    style={{
                        marginTop: '0.75rem',
                        fontSize: '0.9rem',
                        color: status === 'error' ? 'var(--color-danger)' : 'var(--color-success)'
                    }}
                >
                    {message}
                </p>
            )}
        </form>
    );
}
