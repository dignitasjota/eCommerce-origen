'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from './actions';

export default function PaymentsManager({ methods }: { methods: any[] }) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(false);

    const typeIcons: Record<string, string> = { stripe: '💳', paypal: '🅿️', cod: '💵', bizum: '💸', bank_transfer: '🏦' };

    const openModal = (method: any = null) => {
        setEditingMethod(method);
        if (method) {
            const translation = method.payment_method_translations[0];
            setName(translation?.name || '');
            setType(method.type || '');
            setDescription(translation?.description || '');
            setIsActive(method.is_active);
        } else {
            setName('');
            setType('');
            setDescription('');
            setIsActive(false);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingMethod(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const form = e.currentTarget as HTMLFormElement;
        const formData = new FormData(form);
        formData.set('is_active', isActive ? 'true' : 'false');

        try {
            if (editingMethod) {
                await updatePaymentMethod(editingMethod.id, formData);
            } else {
                await createPaymentMethod(formData);
            }
            closeModal();
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al guardar el método de pago');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await deletePaymentMethod(itemToDelete);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Métodos de Pago</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Añadir Pasarela
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-stats-grid">
                    {methods.map((m) => {
                        const t = m.payment_method_translations[0];
                        return (
                            <div key={m.id} className="admin-stat-card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => openModal(m)}>
                                <div className="admin-stat-icon blue" style={{ fontSize: '1.5rem' }}>{typeIcons[m.type] || '💳'}</div>
                                <div className="admin-stat-info">
                                    <h3>{t?.name || m.type}</h3>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>{t?.description || ''}</div>
                                    <span className={`admin-badge ${m.is_active ? 'active' : 'inactive'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(m.id, e)}
                                    className="admin-btn admin-btn-danger admin-btn-sm"
                                    style={{ position: 'absolute', top: '1rem', right: '1rem' }}
                                >
                                    Borrar
                                </button>
                            </div>
                        );
                    })}
                    {methods.length === 0 && (
                        <div className="admin-empty" style={{ gridColumn: '1 / -1' }}>
                            <div className="admin-empty-icon">💳</div>
                            <h3>No hay métodos de pago</h3>
                            <p>Añade un método de pago para que los clientes puedan comprar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
                            </h2>
                            <button className="admin-modal-close" type="button" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Nombre para Mostrar</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="admin-form-input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Tarjeta de Crédito, PayPal..."
                                        required
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Código Interno (Tipo)</label>
                                    <input
                                        type="text"
                                        name="type"
                                        className="admin-form-input"
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        placeholder="Ej: stripe, paypal, cod"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Descripción</label>
                                <textarea
                                    className="admin-form-input"
                                    name="description"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves o detalles que verá el cliente al seleccionar este pago."
                                />
                            </div>

                            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                </label>
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Pasarela Activa en el carrito</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Pasarela'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="modal modal-open modal-bottom sm:modal-middle" style={{ zIndex: 1100 }}>
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">Confirmar borrado</h3>
                        <p className="py-4">¿Estás seguro de que quieres eliminar este método de pago? Esta acción no se puede deshacer.</p>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setItemToDelete(null)} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button className="btn btn-error" onClick={confirmDelete} disabled={isLoading}>
                                {isLoading ? <span className="loading loading-spinner"></span> : 'Eliminar permanentemente'}
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setItemToDelete(null)}>close</button>
                    </form>
                </div>
            )}
        </>
    );
}
