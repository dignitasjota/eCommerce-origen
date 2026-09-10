'use client';

import { useId, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createAddress, updateAddress, deleteAddress, setDefaultAddress } from './actions';

interface AddressItem {
    id: string;
    first_name: string;
    last_name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string | null;
    postal_code: string;
    country: string;
    phone: string | null;
    tax_id: string | null;
    is_default: boolean;
}

interface FormState {
    firstName: string;
    lastName: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
    taxId: string;
    isDefault: boolean;
}

const EMPTY_FORM: FormState = {
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    taxId: '',
    isDefault: false
};

function toFormState(a: AddressItem): FormState {
    return {
        firstName: a.first_name,
        lastName: a.last_name,
        address1: a.address1,
        address2: a.address2 || '',
        city: a.city,
        state: a.state || '',
        postalCode: a.postal_code,
        country: a.country,
        phone: a.phone || '',
        taxId: a.tax_id || '',
        isDefault: a.is_default
    };
}

export default function AddressesManager({ initialAddresses }: { initialAddresses: AddressItem[] }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError(null);
        setShowForm(true);
    };
    const openEdit = (a: AddressItem) => {
        setEditingId(a.id);
        setForm(toFormState(a));
        setError(null);
        setShowForm(true);
    };
    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const fd = new FormData();
            fd.set('firstName', form.firstName);
            fd.set('lastName', form.lastName);
            fd.set('address1', form.address1);
            fd.set('address2', form.address2);
            fd.set('city', form.city);
            fd.set('state', form.state);
            fd.set('postalCode', form.postalCode);
            fd.set('country', form.country);
            fd.set('phone', form.phone);
            fd.set('taxId', form.taxId);
            fd.set('isDefault', String(form.isDefault));

            const result = editingId ? await updateAddress(editingId, fd) : await createAddress(fd);
            if (!result.success) {
                setError(result.error || 'Error al guardar la dirección.');
                return;
            }
            closeForm();
            router.refresh();
        } catch {
            setError('Ha ocurrido un error inesperado.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta dirección?')) return;
        setIsLoading(true);
        try {
            const result = await deleteAddress(id);
            if (!result.success) {
                alert(result.error || 'Error al eliminar la dirección.');
                return;
            }
            router.refresh();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetDefault = async (id: string) => {
        setIsLoading(true);
        try {
            const result = await setDefaultAddress(id);
            if (!result.success) alert(result.error || 'Error al marcar como predeterminada.');
            router.refresh();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Mis Direcciones</h1>
                <button className="btn btn-primary" onClick={openCreate} disabled={isLoading}>
                    Nueva Dirección
                </button>
            </div>

            {initialAddresses.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>No tienes direcciones guardadas.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {initialAddresses.map((address) => (
                        <div
                            key={address.id}
                            style={{
                                backgroundColor: 'var(--color-background-soft)',
                                padding: '1.5rem',
                                borderRadius: 'var(--radius-md)',
                                border: address.is_default ? '2px solid var(--color-primary)' : '1px solid transparent'
                            }}
                        >
                            {address.is_default && (
                                <span
                                    style={{
                                        display: 'inline-block',
                                        backgroundColor: 'var(--color-primary)',
                                        color: 'white',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    Predeterminada
                                </span>
                            )}
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                {address.first_name} {address.last_name}
                            </h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{address.address1}</p>
                            {address.address2 && <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{address.address2}</p>}
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                                {address.postal_code} {address.city}
                            </p>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                                {address.state ? `${address.state}, ` : ''}
                                {address.country}
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => openEdit(address)} disabled={isLoading}>
                                    Editar
                                </button>
                                <button
                                    className="btn btn-outline"
                                    style={{ flex: 1, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                                    onClick={() => handleDelete(address.id)}
                                    disabled={isLoading}
                                >
                                    Eliminar
                                </button>
                                {!address.is_default && (
                                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => handleSetDefault(address.id)} disabled={isLoading}>
                                        Marcar como predeterminada
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingId ? 'Editar dirección' : 'Nueva dirección'}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={closeForm}
                >
                    <div
                        style={{
                            background: 'var(--color-background)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '2rem',
                            maxWidth: '560px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                            {editingId ? 'Editar dirección' : 'Nueva dirección'}
                        </h2>

                        {error && (
                            <div
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: 'var(--color-danger-soft, #fef2f2)',
                                    color: 'var(--color-danger, #b91c1c)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1rem',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <Field label="Nombre" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
                            <Field label="Apellidos" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
                            <Field label="Dirección" value={form.address1} onChange={(v) => setForm({ ...form, address1: v })} required full />
                            <Field label="Piso, puerta… (opcional)" value={form.address2} onChange={(v) => setForm({ ...form, address2: v })} full />
                            <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
                            <Field label="Provincia" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                            <Field label="Código Postal" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} required />
                            <Field label="País" value={form.country} onChange={(v) => setForm({ ...form, country: v })} required />
                            <Field label="Teléfono (opcional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                            <Field label="NIF/CIF (opcional)" value={form.taxId} onChange={(v) => setForm({ ...form, taxId: v })} />

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
                                Usar como dirección predeterminada
                            </label>

                            <div style={{ display: 'flex', gap: '0.75rem', gridColumn: '1 / -1', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={closeForm} disabled={isLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isLoading}>
                                    {isLoading ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    required,
    full
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
    full?: boolean;
}) {
    // `htmlFor`/`id` asocia la etiqueta con el input — sin esto, un lector de
    // pantalla no anuncia qué campo es cuál (y `getByLabel` de Playwright/
    // Testing Library tampoco lo encuentra).
    const id = useId();
    return (
        <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
            <label htmlFor={id} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                {label}
            </label>
            <input
                id={id}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
            />
        </div>
    );
}
