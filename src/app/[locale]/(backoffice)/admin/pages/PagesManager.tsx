'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createPage, updatePage, deletePage } from './actions';
import RichTextEditor from '@/components/backoffice/RichTextEditor';

export default function PagesManager({ initialPages, pagesPrefix, categories }: { initialPages: any[], pagesPrefix: string, categories: any[] }) {
    const router = useRouter();
    const [pages, setPages] = useState(initialPages);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPage, setEditingPage] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, slug: string } | null>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [content, setContent] = useState('');

    const openModal = (page: any = null) => {
        setEditingPage(page);
        if (page) {
            setTitle(page.page_translations[0]?.title || '');
            setSlug(page.slug || '');
            setContent(page.page_translations[0]?.content || '');
        } else {
            setTitle('');
            setSlug('');
            setContent('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPage(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('slug', slug);
        formData.append('content', content);

        try {
            if (editingPage) {
                await updatePage(editingPage.id, formData);
            } else {
                await createPage(formData);
            }
            closeModal();
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al guardar la página');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string, pageSlug: string) => {
        setItemToDelete({ id, slug: pageSlug });
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await deletePage(itemToDelete.id);
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
                <h1 className="admin-topbar-title">Páginas de Contenido</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nueva Página
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{pages.length} páginas</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Título de la Página</th>
                                <th>Slug (URL)</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((p) => {
                                const t = p.page_translations[0];
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.title || p.slug}</td>
                                        <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{p.slug}</code></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => openModal(p)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar
                                                </button>
                                                <button onClick={() => handleDelete(p.id, p.slug)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pages.length === 0 && (
                                <tr>
                                    <td colSpan={3}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📄</div>
                                            <h3>Aún no has creado páginas de contenido (ej: Sobre Nosotros)</h3>
                                            <button onClick={() => openModal()} className="admin-btn admin-btn-primary" style={{ marginTop: '1rem' }}>
                                                Crear la primera página
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
                    <div className="admin-modal" style={{ maxWidth: '800px', width: '90vw' }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingPage ? 'Editar Página' : 'Nueva Página'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Título visible de la Página</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    placeholder="Ej: Sobre Nosotros"
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Slug para URL</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                    required
                                    placeholder="Ej: sobre-nosotros"
                                />
                                <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '0.25rem' }}>Aparecerá en www.tutienda.com{pagesPrefix ? `/${pagesPrefix}` : ''}/<b>{slug || '...'}</b></p>
                            </div>

                            <div className="admin-form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                    <label className="admin-form-label" style={{ marginBottom: 0 }}>Contenido HTML</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <select id="categorySelect" className="admin-form-input" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', height: 'auto', width: 'auto' }}>
                                            <option value="">Selecciona una categoría...</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.slug}>{c.category_translations[0]?.name || c.slug}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn-secondary admin-btn-sm"
                                            onClick={() => {
                                                const select = document.getElementById('categorySelect') as HTMLSelectElement;
                                                if (select && select.value) {
                                                    setContent(prev => prev + `\n{{category_id:${select.value}}}`);
                                                }
                                            }}>
                                            + Insertar Categoría
                                        </button>
                                    </div>
                                </div>
                                <RichTextEditor
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Escribe aquí el contenido de la página…"
                                    minHeight="30vh"
                                />
                                <p style={{ fontSize: '0.75rem', color: 'gray', marginTop: '0.25rem' }}>
                                    Los shortcodes <code>{'{{category_id:slug}}'}</code> se conservan en el HTML y se renderizan en el storefront.
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Página'}
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
                        <p className="py-4">¿Seguro que deseas eliminar la página <strong>{pagesPrefix ? `/${pagesPrefix}` : ''}/{itemToDelete.slug}</strong>? Esta acción no se puede deshacer.</p>
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
