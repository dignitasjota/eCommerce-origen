'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createShippingMethod, updateShippingMethod, deleteShippingMethod } from './actions';

export default function ShippingManager({ initialMethods }: { initialMethods: any[] }) {
    const router = useRouter();
    const [methods, setMethods] = useState(initialMethods);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [freeAbove, setFreeAbove] = useState('');
    const [minWeight, setMinWeight] = useState('');
    const [maxWeight, setMaxWeight] = useState('');
    const [estimatedDays, setEstimatedDays] = useState('');
    const [isActive, setIsActive] = useState(true);

    const openModal = (method: any = null) => {
        setEditingMethod(method);
        if (method) {
            setName(method.shipping_method_translations[0]?.name || '');
            setPrice(method.price ? Number(method.price).toString() : '0');
            setFreeAbove(method.free_above ? Number(method.free_above).toString() : '');
            setMinWeight(method.min_weight ? Number(method.min_weight).toString() : '');
            setMaxWeight(method.max_weight ? Number(method.max_weight).toString() : '');
            setEstimatedDays(method.estimated_days || '');
            setIsActive(method.is_active);
        } else {
            setName('');
            setPrice('');
            setFreeAbove('');
            setMinWeight('');
            setMaxWeight('');
            setEstimatedDays('');
            setIsActive(true);
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

        const formData = new FormData();
        formData.append('name', name);
        formData.append('price', price || '0');
        if (freeAbove) formData.append('free_above', freeAbove);
        if (minWeight) formData.append('min_weight', minWeight);
        if (maxWeight) formData.append('max_weight', maxWeight);
        if (estimatedDays) formData.append('estimated_days', estimatedDays);
        formData.append('is_active', isActive ? 'true' : 'false');

        try {
            if (editingMethod) {
                await updateShippingMethod(editingMethod.id, formData);
            } else {
                await createShippingMethod(formData);
            }
            closeModal();
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al guardar el método de envío');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await deleteShippingMethod(itemToDelete);
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al eliminar');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Métodos de Envío</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo Método
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{methods.length} métodos disponibles</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Método</th>
                                <th>Precio</th>
                                <th>Gratis desde</th>
                                <th>Peso Requerido (Kg)</th>
                                <th>Días Estimados</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {methods.map((m) => {
                                const t = m.shipping_method_translations[0];
                                return (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.name || '—'}</td>
                                        <td>{Number(m.price) === 0 ? 'Gratis' : `${Number(m.price).toFixed(2)}€`}</td>
                                        <td>{m.free_above ? `${Number(m.free_above)}€` : '—'}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{m.min_weight || m.max_weight ? `${m.min_weight || 0} – ${m.max_weight || '∞'} kg` : 'Cualquiera'}</td>
                                        <td>{m.estimated_days ? `${m.estimated_days} días` : '—'}</td>
                                        <td><span className={`admin-badge ${m.is_active ? 'active' : 'inactive'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => openModal(m)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar
                                                </button>
                                                <button onClick={() => handleDelete(m.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {methods.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">🚚</div>
                                            <h3>No hay métodos de envío configurados</h3>
                                            <button onClick={() => openModal()} className="admin-btn admin-btn-primary" style={{ marginTop: '1rem' }}>
                                                Crear método
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingMethod ? 'Editar Método de Envío' : 'Nuevo Método de Envío'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Nombre del Método (Ej: Seur 24h)</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Precio (€)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="admin-form-input"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        required
                                        placeholder="Ej: 4.95 (0 para gratis)"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Gratis al superar (€)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="admin-form-input"
                                        value={freeAbove}
                                        onChange={(e) => setFreeAbove(e.target.value)}
                                        placeholder="Ej: 50.00"
                                    />
                                </div>
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Peso Mínimo del Pedido (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        className="admin-form-input"
                                        value={minWeight}
                                        onChange={(e) => setMinWeight(e.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Peso Máximo del Pedido (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        className="admin-form-input"
                                        value={maxWeight}
                                        onChange={(e) => setMaxWeight(e.target.value)}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Tiempo estimado en tránsito</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={estimatedDays}
                                    onChange={(e) => setEstimatedDays(e.target.value)}
                                    placeholder="Ej: 1-2 (sólo informativo)"
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
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Método Activo (Visible en Checkout)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Método de Envío'}
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
                        <p className="py-4">¿Estás seguro de que quieres eliminar este método de envío? Esta acción no se puede deshacer.</p>
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
