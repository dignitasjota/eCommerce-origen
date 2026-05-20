'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { AdminCategory } from '@/types/admin';
import { updateCategory, createCategory, deleteCategory } from './actions';
import ImageUploader from '@/components/backoffice/ImageUploader';

export default function CategoriesManager({ initialCategories, allParentCategories }: { initialCategories: AdminCategory[], allParentCategories: AdminCategory[] }) {
    const router = useRouter();
    const [categories, setCategories] = useState(initialCategories);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [parentId, setParentId] = useState('');
    const [isActive, setIsActive] = useState(true);

    const openModal = (category: AdminCategory | null = null) => {
        setEditingCategory(category);
        if (category) {
            setName(category.category_translations[0]?.name || '');
            setSlug(category.slug || '');
            setParentId(category.parent_id || '');
            setIsActive(category.is_active);
        } else {
            setName('');
            setSlug('');
            setParentId('');
            setIsActive(true);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        // Add React states manually (since inputs lack 'name' attrs, except 'image')
        formData.append('name', name);
        formData.append('slug', slug);
        if (parentId) formData.append('parent_id', parentId);
        formData.append('is_active', isActive ? 'true' : 'false');

        try {
            if (editingCategory) {
                await updateCategory(editingCategory.id, formData);
            } else {
                await createCategory(formData);
            }
            closeModal();
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al guardar la categoría');
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
            await deleteCategory(itemToDelete);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar la categoría');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Categorías</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nueva Categoría
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{categories.length} categorías principales</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Categoría</th>
                                <th>ID</th>
                                <th>Imagen</th>
                                <th>Nombre</th>
                                <th>Slug</th>
                                <th>Padre</th>
                                <th>Productos</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((cat) => {
                                const t = cat.category_translations[0];
                                return (
                                    <React.Fragment key={cat.id}>
                                        <tr>
                                            <td style={{ fontWeight: 600 }}>
                                                {cat.image && <span style={{ marginRight: 8 }}>🖼</span>}
                                                {t?.name || cat.slug}
                                            </td>
                                            <td>
                                                <code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                                                    ...{cat.id.split('-')[0]}
                                                </code>
                                            </td>
                                            <td>
                                                {cat.image ? (
                                                    <img src={cat.image} alt="Cat" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                                ) : (
                                                    <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>📁</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>{t?.name || cat.slug}</td>
                                            <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{cat.slug}</code></td>
                                            <td>—</td>
                                            <td>{cat._count?.product_categories || 0}</td>
                                            <td>
                                                <span className={`admin-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                                                    {cat.is_active ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => openModal(cat)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                        Editar
                                                    </button>
                                                    <button onClick={() => handleDelete(cat.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                        Borrar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {cat.other_categories?.map((sub: any) => {
                                            const st = sub.category_translations[0];
                                            return (
                                                <tr key={sub.id}>
                                                    <td style={{ paddingLeft: '2.5rem', color: 'var(--color-text-secondary)' }}>
                                                        ↳ {st?.name || sub.slug}
                                                    </td>
                                                    <td>
                                                        <code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                                                            ...{sub.id.split('-')[0]}
                                                        </code>
                                                    </td>
                                                    <td>
                                                        {sub.image ? (
                                                            <img src={sub.image} alt="Sub Cat" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>📁</span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: 'var(--color-text-secondary)' }}>{st?.name || sub.slug}</td>
                                                    <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{sub.slug}</code></td>
                                                    <td>{t?.name}</td>
                                                    <td>{sub._count?.product_categories || 0}</td>
                                                    <td>
                                                        <span className={`admin-badge ${sub.is_active ? 'active' : 'inactive'}`}>
                                                            {sub.is_active ? 'Activa' : 'Inactiva'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button onClick={() => openModal(sub)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                                Editar
                                                            </button>
                                                            <button onClick={() => handleDelete(sub.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                                Borrar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Edición/Creación */}
            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Nombre de la Categoría</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Slug (URL amigable)</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Categoría Padre</label>
                                <select
                                    className="admin-form-select"
                                    value={parentId}
                                    onChange={(e) => setParentId(e.target.value)}
                                >
                                    <option value="">(Ninguna - Es categoría principal)</option>
                                    {allParentCategories.map((p) => (
                                        // Prevents assigning a category to itself
                                        p.id !== editingCategory?.id && (
                                            <option key={p.id} value={p.id}>
                                                {p.category_translations[0]?.name || p.slug}
                                            </option>
                                        )
                                    ))}
                                </select>
                            </div>

                            <div className="admin-form-group">
                                <ImageUploader
                                    label="Imagen destacada"
                                    name="image"
                                    orderFieldName="images_order"
                                    multiple={false}
                                    existingImages={
                                        editingCategory?.image
                                            ? [{ id: 'current', url: editingCategory.image, sort_order: 0 }]
                                            : []
                                    }
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
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Categoría Activa (Visible en tienda)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Categoría'}
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
                        <p className="py-4">¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer.</p>
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
