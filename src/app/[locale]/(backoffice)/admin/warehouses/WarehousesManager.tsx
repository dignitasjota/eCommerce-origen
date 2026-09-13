'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createWarehouse, updateWarehouse, deleteWarehouse } from './actions';

interface Warehouse {
    id: string;
    name: string;
    code: string;
    address1: string | null;
    address2: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    priority: number;
    is_active: boolean;
    is_dropshipping: boolean;
}

export default function WarehousesManager({ initialWarehouses }: { initialWarehouses: Warehouse[] }) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('ES');
    const [priority, setPriority] = useState('0');
    const [isActive, setIsActive] = useState(true);
    const [isDropshipping, setIsDropshipping] = useState(false);

    const openModal = (warehouse: Warehouse | null = null) => {
        setEditingWarehouse(warehouse);
        setFormError(null);
        if (warehouse) {
            setName(warehouse.name);
            setCode(warehouse.code);
            setAddress1(warehouse.address1 || '');
            setAddress2(warehouse.address2 || '');
            setCity(warehouse.city || '');
            setPostalCode(warehouse.postal_code || '');
            setCountry(warehouse.country || 'ES');
            setPriority(String(warehouse.priority));
            setIsActive(warehouse.is_active);
            setIsDropshipping(warehouse.is_dropshipping);
        } else {
            setName('');
            setCode('');
            setAddress1('');
            setAddress2('');
            setCity('');
            setPostalCode('');
            setCountry('ES');
            setPriority('0');
            setIsActive(true);
            setIsDropshipping(false);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingWarehouse(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setFormError(null);

        const input = {
            name, code, address1, address2, city,
            postal_code: postalCode, country, priority,
            is_active: isActive, is_dropshipping: isDropshipping
        };

        const result = editingWarehouse
            ? await updateWarehouse(editingWarehouse.id, input)
            : await createWarehouse(input);

        setIsLoading(false);
        if (!result.success) {
            setFormError(result.error || 'Error al guardar el almacén');
            return;
        }
        closeModal();
        router.refresh();
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            const result = await deleteWarehouse(itemToDelete);
            if (!result.success) {
                alert(result.error || 'Error al eliminar');
            }
            router.refresh();
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Almacenes</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo almacén
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5', maxWidth: '760px' }}>
                    El checkout asigna el stock al almacén activo de menor prioridad que tenga unidades suficientes.
                    Un almacén de <strong>drop shipping</strong> tiene capacidad virtual — nunca bloquea una venta por
                    falta de stock local, pero se usa antes que los físicos si su prioridad es menor. Gestiona el
                    stock de cada variante por almacén desde la ficha de cada producto.
                </p>
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{initialWarehouses.length} almacenes</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Prioridad</th>
                                <th>Nombre</th>
                                <th>Código</th>
                                <th>Ubicación</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialWarehouses.map((w) => (
                                <tr key={w.id}>
                                    <td>{w.priority}</td>
                                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                                    <td><code>{w.code}</code></td>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                        {[w.city, w.country].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td>{w.is_dropshipping ? 'Drop shipping' : 'Físico'}</td>
                                    <td><span className={`admin-badge ${w.is_active ? 'active' : 'inactive'}`}>{w.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => openModal(w)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                Editar
                                            </button>
                                            <button onClick={() => setItemToDelete(w.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {initialWarehouses.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="admin-empty">
                                            <h3>No hay almacenes configurados</h3>
                                            <button onClick={() => openModal()} className="admin-btn admin-btn-primary" style={{ marginTop: '1rem' }}>
                                                Crear almacén
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">{editingWarehouse ? 'Editar almacén' : 'Nuevo almacén'}</h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Nombre</label>
                                    <input type="text" className="admin-form-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Almacén principal" />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Código</label>
                                    <input type="text" className="admin-form-input" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Ej: MAIN" />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Dirección</label>
                                <input type="text" className="admin-form-input" value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Calle y número" style={{ marginBottom: '0.5rem' }} />
                                <input type="text" className="admin-form-input" value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="Piso, puerta… (opcional)" />
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Ciudad</label>
                                    <input type="text" className="admin-form-input" value={city} onChange={(e) => setCity(e.target.value)} />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Código postal</label>
                                    <input type="text" className="admin-form-input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">País (ISO-2)</label>
                                    <input type="text" className="admin-form-input" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="ES" />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Prioridad de asignación (menor = primero)</label>
                                <input type="number" step="1" className="admin-form-input" value={priority} onChange={(e) => setPriority(e.target.value)} required />
                            </div>

                            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                </label>
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Almacén activo (disponible para asignar stock)</span>
                            </div>

                            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isDropshipping} onChange={(e) => setIsDropshipping(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                </label>
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Drop shipping (capacidad virtual, sin stock local)</span>
                            </div>

                            {formError && (
                                <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{formError}</p>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar almacén'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {itemToDelete && (
                <div className="modal modal-open modal-bottom sm:modal-middle" style={{ zIndex: 1100 }}>
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">Confirmar borrado</h3>
                        <p className="py-4">¿Estás seguro de que quieres eliminar este almacén? Esta acción no se puede deshacer.</p>
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
