'use client';

import React, { useState } from 'react';
import { createLegalPage, updateLegalPage, deleteLegalPage } from './actions';

export default function LegalManager({ initialPages }: { initialPages: any[] }) {
    const [pages, setPages] = useState(initialPages);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPage, setEditingPage] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [content, setContent] = useState('');

    const openModal = (page: any = null) => {
        setEditingPage(page);
        if (page) {
            setTitle(page.legal_page_translations[0]?.title || '');
            setSlug(page.slug || '');
            setContent(page.legal_page_translations[0]?.content || '');
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
                await updateLegalPage(editingPage.id, formData);
            } else {
                await createLegalPage(formData);
            }
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al guardar la página');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, pageSlug: string) => {
        if (!confirm(`¿Seguro que deseas eliminar la página /legal/${pageSlug}?`)) return;
        setIsLoading(true);
        try {
            await deleteLegalPage(id);
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al eliminar');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Páginas Legales</h1>
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
                                const t = p.legal_page_translations[0];
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
                                            <div className="admin-empty-icon">⚖️</div>
                                            <h3>Aún no has creado páginas legales (ej: Privacidad)</h3>
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
                    {/* El modal de páginas legales debe ser más ancho dada la zona de texto html */}
                    <div className="admin-modal" style={{ maxWidth: '800px', width: '90vw' }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingPage ? 'Editar Página Legal' : 'Nueva Página Legal'}
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
                                    placeholder="Ej: Política de Privacidad"
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
                                    placeholder="Ej: politica-privacidad"
                                />
                                <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '0.25rem' }}>Aparecerá en www.tutienda.com/es/legal/<b>{slug || '...'}</b></p>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Contenido HTML</label>
                                <textarea
                                    className="admin-form-input"
                                    style={{ minHeight: '30vh', resize: 'vertical' }}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    required
                                    placeholder="<p>Escribe aquí el contenido legal de la página...</p>"
                                />
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
        </>
    );
}
