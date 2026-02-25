'use client';

import React, { useState } from 'react';
import { createCoupon, updateCoupon, deleteCoupon } from './actions';

export default function CouponsManager({ initialCoupons }: { initialCoupons: any[] }) {
    const [coupons, setCoupons] = useState(initialCoupons);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Form states
    const [code, setCode] = useState('');
    const [discountType, setDiscountType] = useState('PERCENTAGE'); // PERCENTAGE o FIXED
    const [discountValue, setDiscountValue] = useState('');
    const [minPurchase, setMinPurchase] = useState('');
    const [maxUses, setMaxUses] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [expiresAt, setExpiresAt] = useState('');

    const openModal = (coupon: any = null) => {
        setEditingCoupon(coupon);
        if (coupon) {
            setCode(coupon.code || '');
            setDiscountType(coupon.discount_type || 'PERCENTAGE');
            setDiscountValue(coupon.discount_value ? Number(coupon.discount_value).toString() : '');
            setMinPurchase(coupon.min_purchase ? Number(coupon.min_purchase).toString() : '');
            setMaxUses(coupon.max_uses ? coupon.max_uses.toString() : '');
            setIsActive(coupon.is_active);

            // Format date for datetime-local input
            if (coupon.expires_at) {
                const date = new Date(coupon.expires_at);
                setExpiresAt(date.toISOString().slice(0, 16));
            } else {
                setExpiresAt('');
            }
        } else {
            setCode('');
            setDiscountType('PERCENTAGE');
            setDiscountValue('');
            setMinPurchase('');
            setMaxUses('');
            setIsActive(true);
            setExpiresAt('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCoupon(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData();
        formData.append('code', code);
        formData.append('discount_type', discountType);
        formData.append('discount_value', discountValue);
        if (minPurchase) formData.append('min_purchase', minPurchase);
        if (maxUses) formData.append('max_uses', maxUses);
        formData.append('is_active', isActive ? 'true' : 'false');
        if (expiresAt) {
            // Convierte nuevamente a ISO Date con timezone correcta
            formData.append('expires_at', new Date(expiresAt).toISOString());
        }

        try {
            if (editingCoupon) {
                await updateCoupon(editingCoupon.id, formData);
            } else {
                await createCoupon(formData);
            }
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al guardar el cupón');
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
            await deleteCoupon(itemToDelete);
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el cupón');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Cupones</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo Cupón
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{coupons.length} cupones</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Compra mínima</th>
                                <th>Usos</th>
                                <th>Estado</th>
                                <th>Expira</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((c) => (
                                <tr key={c.id}>
                                    <td><code style={{ fontSize: '0.85rem', fontWeight: 700, background: 'var(--color-background)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{c.code}</code></td>
                                    <td>{c.discount_type === 'PERCENTAGE' ? 'Porcentaje' : 'Fijo'}</td>
                                    <td style={{ fontWeight: 600 }}>{c.discount_type === 'PERCENTAGE' ? `${Number(c.discount_value)}%` : `${Number(c.discount_value)}€`}</td>
                                    <td>{c.min_purchase ? `${Number(c.min_purchase)}€` : '—'}</td>
                                    <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                                    <td><span className={`admin-badge ${c.is_active ? 'active' : 'inactive'}`}>{c.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-ES') : 'Sin expiración'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => openModal(c)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                Editar
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {coupons.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">🎟️</div>
                                            <h3>No has creado ningún cupón aún</h3>
                                            <button onClick={() => openModal()} className="admin-btn admin-btn-primary" style={{ marginTop: '1rem' }}>
                                                Crear el primero
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Cupones */}
            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón de Descuento'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Código del Cupón (MAYÚSCULAS)</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    required
                                    placeholder="EJ: VERANO20"
                                />
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Tipo de Descuento</label>
                                    <select
                                        className="admin-form-select"
                                        value={discountType}
                                        onChange={(e) => setDiscountType(e.target.value)}
                                    >
                                        <option value="PERCENTAGE">Porcentaje (%)</option>
                                        <option value="FIXED">Fijo (Euros €)</option>
                                    </select>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Valor del Descuento</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="admin-form-input"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        required
                                        placeholder={discountType === 'PERCENTAGE' ? 'Ej: 15' : 'Ej: 10.50'}
                                    />
                                </div>
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Compra Mínima (Opcional)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="admin-form-input"
                                        value={minPurchase}
                                        onChange={(e) => setMinPurchase(e.target.value)}
                                        placeholder="Ej: 50.00"
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Límite de usos (Opcional)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="admin-form-input"
                                        value={maxUses}
                                        onChange={(e) => setMaxUses(e.target.value)}
                                        placeholder="Ej: 100 (vacío = infinito)"
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Fecha de Expiración (Opcional)</label>
                                <input
                                    type="datetime-local"
                                    className="admin-form-input"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>Déjalo en blanco si el cupón nunca caduca.</p>
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
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Activar Cupón (Listo para usarse)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Cupón'}
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
                        <p className="py-4">¿Estás seguro de que quieres eliminar este cupón permanentemente? Esta acción no se puede deshacer.</p>
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
