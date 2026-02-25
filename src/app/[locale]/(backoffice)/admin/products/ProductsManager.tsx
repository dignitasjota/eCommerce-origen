'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct, deleteProduct } from './actions';

export default function ProductsManager({ products }: { products: any[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [description, setDescription] = useState('');
    const [stock, setStock] = useState('0');

    const openModal = (product: any = null) => {
        setEditingProduct(product);
        if (product) {
            setName(product.product_translations[0]?.name || '');
            setSlug(product.slug || '');
            setSku(product.sku || '');
            setPrice(product.price?.toString() || '');
            setIsActive(product.is_active);
            setDescription(product.product_translations[0]?.description || '');
            setStock(product.product_variants?.[0]?.stock?.toString() || '0');
        } else {
            setName('');
            setSlug('');
            setSku('');
            setPrice('');
            setIsActive(true);
            setDescription('');
            setStock('0');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const form = e.currentTarget as HTMLFormElement;
        const formData = new FormData(form);

        // Ensure switch states are added if inputs are not tracked correctly by default FormData
        formData.set('is_active', isActive ? 'true' : 'false');

        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, formData);
            } else {
                await createProduct(formData);
            }
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error al guardar el producto');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;
        setIsLoading(true);
        try {
            await deleteProduct(id);
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el producto');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Productos</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{products.length} productos</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>SKU</th>
                                <th>Precio / Stock</th>
                                <th>Categoría</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => {
                                const translation = product.product_translations[0];
                                const category = product.product_categories[0]?.categories?.category_translations[0];
                                const image = product.product_images?.length ? product.product_images[0] : null;
                                const prodStock = product.product_variants?.[0]?.stock || 0;

                                return (
                                    <tr key={product.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: 8,
                                                    background: 'var(--color-background)', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    overflow: 'hidden', flexShrink: 0,
                                                }}>
                                                    {image ? (
                                                        <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: '1.2rem' }}>📷</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{translation?.name || product.slug}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{product.slug}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{product.sku}</code></td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{Number(product.price).toFixed(2)}€</div>
                                            <div style={{ fontSize: '0.8rem', color: prodStock > 0 ? 'green' : 'red' }}>Stock: {prodStock}</div>
                                        </td>
                                        <td>{category?.name || '—'}</td>
                                        <td>
                                            <span className={`admin-badge ${product.is_active ? 'active' : 'inactive'}`}>
                                                {product.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => openModal(product)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar opciones
                                                </button>
                                                <Link href={`/es/admin/products/${product.id}/edit`} className="admin-btn admin-btn-outline admin-btn-sm">
                                                    Sugerencias (Cross-Sell)
                                                </Link>
                                                <button onClick={() => handleDelete(product.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📦</div>
                                            <h3>No hay productos aún</h3>
                                            <p>Crea tu primer producto para empezar a vender</p>
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
                                {editingProduct ? 'Editar Producto' : 'Crear Producto'}
                            </h2>
                            <button className="admin-modal-close" type="button" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }} encType="multipart/form-data">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Nombre del Producto</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="admin-form-input"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Slug (URL)</label>
                                    <input
                                        type="text"
                                        name="slug"
                                        className="admin-form-input"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">SKU</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        className="admin-form-input"
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Precio base (€)</label>
                                    <input
                                        type="number"
                                        name="price"
                                        step="0.01"
                                        className="admin-form-input"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Stock Actual</label>
                                    <input
                                        type="number"
                                        name="stock"
                                        className="admin-form-input"
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Descripción HTML / Texto</label>
                                <textarea
                                    className="admin-form-input"
                                    name="description"
                                    rows={5}
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">Escribe aquí todo sobre tu producto, admite etiquetas HTML básicas para enriquecer el texto.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Imagen Principal</label>
                                    {editingProduct?.product_images?.[0] && (
                                        <div className="mb-2 p-2 bg-gray-100 rounded-md inline-block">
                                            <img src={editingProduct.product_images[0].url} alt="Main" style={{ maxHeight: '40px', objectFit: 'contain' }} />
                                            <p className="text-xs text-gray-500 mt-1">Sube una nueva si quieres reemplazarla.</p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        name="main_image"
                                        accept="image/*"
                                        className="admin-form-input p-2"
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Añadir Fotos Secundarias</label>
                                    {editingProduct?.product_images?.length > 1 && (
                                        <div className="mb-2 p-2 bg-gray-100 rounded-md">
                                            <p className="text-xs text-gray-500 mb-1">Ya hay {editingProduct.product_images.length - 1} foto/s en galería. Puedes subir más para añadirlas:</p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        name="gallery_images"
                                        accept="image/*"
                                        multiple
                                        className="admin-form-input p-2"
                                    />
                                </div>
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
                                <span className="admin-form-label" style={{ marginBottom: 0 }}>Producto Visible (Activo)</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
