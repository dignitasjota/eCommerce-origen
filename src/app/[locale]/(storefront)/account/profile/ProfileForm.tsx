'use client';

import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { updateProfile } from './actions';

interface ProfileFormProps {
    name: string;
    email: string;
    phone: string;
}

export default function ProfileForm({ name, email, phone }: ProfileFormProps) {
    const router = useRouter();
    const [formName, setFormName] = useState(name);
    const [formPhone, setFormPhone] = useState(phone);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
    const nameId = useId();
    const phoneId = useId();
    const emailId = useId();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        try {
            const fd = new FormData();
            fd.set('name', formName);
            fd.set('phone', formPhone);
            const result = await updateProfile(fd);
            if (result.success) {
                setMessage({ text: 'Perfil actualizado correctamente.', isError: false });
                router.refresh();
            } else {
                setMessage({ text: result.error || 'Error al actualizar el perfil.', isError: true });
            }
        } catch {
            setMessage({ text: 'Ha ocurrido un error inesperado.', isError: true });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {message && (
                <div
                    role="status"
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.9rem',
                        background: message.isError ? 'var(--color-danger-soft, #fef2f2)' : 'var(--color-success-soft, #ecfdf5)',
                        color: message.isError ? 'var(--color-danger, #b91c1c)' : 'var(--color-success, #047857)'
                    }}
                >
                    {message.text}
                </div>
            )}

            <div>
                <label htmlFor={nameId} style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Nombre Completo
                </label>
                <input
                    id={nameId}
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={isLoading}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
            </div>

            <div>
                <label htmlFor={phoneId} style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Teléfono
                </label>
                <input
                    id={phoneId}
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    maxLength={50}
                    disabled={isLoading}
                    placeholder="Opcional"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                />
            </div>

            <div>
                <label htmlFor={emailId} style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Correo Electrónico
                </label>
                <input
                    id={emailId}
                    type="email"
                    defaultValue={email}
                    disabled
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                />
                <small style={{ color: 'var(--color-text-tertiary)', marginTop: '0.25rem', display: 'block' }}>
                    El correo no se puede cambiar.
                </small>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Guardando…' : 'Guardar Cambios'}
                </button>
            </div>
        </form>
    );
}
