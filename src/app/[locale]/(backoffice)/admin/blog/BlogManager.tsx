'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createBlogPost, updateBlogPost, deleteBlogPost } from './actions';
import ImageUploader from '@/components/backoffice/ImageUploader';
import RichTextEditor from '@/components/backoffice/RichTextEditor';

export default function BlogManager({ posts }: { posts: any[] }) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [content, setContent] = useState('');
    const [isPublished, setIsPublished] = useState(false);

    const openModal = (post: any = null) => {
        setEditingPost(post);
        if (post) {
            setTitle(post.blog_post_translations[0]?.title || '');
            setSlug(post.slug || '');
            setExcerpt(post.blog_post_translations[0]?.excerpt || '');
            setContent(post.blog_post_translations[0]?.content || '');
            setIsPublished(post.is_published);
        } else {
            setTitle('');
            setSlug('');
            setExcerpt('');
            setContent('');
            setIsPublished(false);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPost(null);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        // Recogemos los inputs declarativamente del propio <form> para incluir
        // el archivo de imagen del ImageUploader y `images_order`. El resto
        // (title/slug/excerpt/content/is_published) los seteamos a partir del
        // estado React para no depender de inputs hidden adicionales.
        const formData = new FormData(e.currentTarget);
        formData.set('title', title);
        formData.set('slug', slug);
        formData.set('excerpt', excerpt);
        formData.set('content', content);
        formData.set('is_published', isPublished ? 'true' : 'false');

        try {
            if (editingPost) {
                await updateBlogPost(editingPost.id, formData);
            } else {
                await createBlogPost(formData);
            }
            closeModal();
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al guardar el artículo');
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
            await deleteBlogPost(itemToDelete);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el artículo');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Blog</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo Artículo
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{posts.length} artículos</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Slug</th>
                                <th>Estado</th>
                                <th>Publicado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((p) => {
                                const t = p.blog_post_translations[0];
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.title || p.slug}</td>
                                        <td>
                                            <code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                                                {p.slug}
                                            </code>
                                        </td>
                                        <td>
                                            <span className={`admin-badge ${p.is_published ? 'active' : 'inactive'}`}>
                                                {p.is_published ? 'Publicado' : 'Borrador'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                            {p.published_at ? new Date(p.published_at).toLocaleDateString('es-ES') : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => openModal(p)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {posts.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📰</div>
                                            <h3>No hay artículos aún</h3>
                                            <p>Crea tu primer post para atraer visualizaciones y mejorar tu SEO.</p>
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
                <div className="admin-modal-overlay" onClick={closeModal} style={{ zIndex: 1000, alignContent: 'center' }}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingPost ? 'Editar Artículo' : 'Nuevo Artículo'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Título del Artículo</label>
                                    <input
                                        type="text"
                                        className="admin-form-input"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
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
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Extracto breve (Resumen)</label>
                                <textarea
                                    className="admin-form-input"
                                    rows={2}
                                    value={excerpt}
                                    onChange={(e) => setExcerpt(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Texto plano. Aparece en la lista del blog y como meta descripción.</p>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Contenido completo</label>
                                <RichTextEditor
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Escribe el contenido del artículo…"
                                    minHeight="320px"
                                />
                            </div>

                            <div className="admin-form-group">
                                <ImageUploader
                                    label="Imagen de portada"
                                    name="image"
                                    orderFieldName="images_order"
                                    multiple={false}
                                    aspectRatio={16 / 9}
                                    existingImages={
                                        editingPost?.image
                                            ? [{ id: 'current', url: editingPost.image, sort_order: 0 }]
                                            : []
                                    }
                                />
                            </div>

                            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isPublished}
                                        onChange={(e) => setIsPublished(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                                </label>
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Publicar Artículo (Será visible en la tienda)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Artículo'}
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
                        <p className="py-4">¿Estás seguro de que quieres eliminar este artículo? Esta acción no se puede deshacer.</p>
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
