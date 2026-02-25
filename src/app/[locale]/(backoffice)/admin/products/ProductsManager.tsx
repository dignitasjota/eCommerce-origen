'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createProduct, updateProduct, deleteProduct, updateProductRelations } from './actions';

export default function ProductsManager({ products }: { products: any[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    // ---- Product Core Edit Modal States ----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [sku, setSku] = useState('');
    const [price, setPrice] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [description, setDescription] = useState('');
    const [stock, setStock] = useState('0');

    // ---- Relations Edit Modal States ----
    const [isRelationsModalOpen, setIsRelationsModalOpen] = useState(false);
    const [relationsProduct, setRelationsProduct] = useState<any>(null);
    const [crossSells, setCrossSells] = useState<string[]>([]);
    const [upSells, setUpSells] = useState<string[]>([]);
    const [isRelationsLoading, setIsRelationsLoading] = useState(false);

    // --- Core Edit Functions ---
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

    const handleDelete = (id: string) => {
        setItemToDelete(id);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await deleteProduct(itemToDelete);
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el producto');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    // --- Relations Edit Functions ---
    const openRelationsModal = (product: any) => {
        setRelationsProduct(product);

        const existingRelations = product.related_to || [];
        const initialCrossSells = existingRelations.filter((r: any) => r.relation_type === 'CROSS_SELL').map((r: any) => r.related_product_id);
        const initialUpSells = existingRelations.filter((r: any) => r.relation_type === 'UP_SELL').map((r: any) => r.related_product_id);

        setCrossSells(initialCrossSells);
        setUpSells(initialUpSells);
        setIsRelationsModalOpen(true);
    };

    const closeRelationsModal = () => {
        setIsRelationsModalOpen(false);
        setRelationsProduct(null);
        setCrossSells([]);
        setUpSells([]);
    };

    const handleSelectMultiple = (e: React.ChangeEvent<HTMLSelectElement>, setter: Function) => {
        const options = Array.from(e.target.selectedOptions, option => option.value);
        setter(options);
    };

    const handleRelationsSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!relationsProduct) return;

        setIsRelationsLoading(true);
        const result = await updateProductRelations(relationsProduct.id, crossSells, upSells);
        setIsRelationsLoading(false);

        if (result.success) {
            alert('Relaciones actualizadas exitosamente');
            window.location.reload();
        } else {
            alert(result.error);
        }
    };

    const filteredProducts = React.useMemo(() => {
        if (!searchTerm) return products;
        const lowerSearch = searchTerm.toLowerCase();

        return products.filter(product => {
            const nameMatch = product.product_translations[0]?.name?.toLowerCase().includes(lowerSearch) ?? false;
            const slugMatch = product.slug?.toLowerCase().includes(lowerSearch) ?? false;
            const skuMatch = product.sku?.toLowerCase().includes(lowerSearch) ?? false;
            const categoryMatch = product.product_categories[0]?.categories?.category_translations[0]?.name?.toLowerCase().includes(lowerSearch) ?? false;

            return nameMatch || slugMatch || skuMatch || categoryMatch;
        });
    }, [products, searchTerm]);

    return (
        <>
            {/* Topbar */}
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Productos</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="admin-table-title">{filteredProducts.length} productos</h2>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                                🔍
                            </span>
                            <input
                                type="text"
                                className="admin-form-input"
                                placeholder="Buscar por nombre, SKU o categoría..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', margin: 0 }}
                            />
                        </div>
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
                            {filteredProducts.map((product) => {
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
                                                <button onClick={() => openRelationsModal(product)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Sugerencias (Cross-Sell)
                                                </button>
                                                <button onClick={() => handleDelete(product.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="admin-empty">
                                            <div className="admin-empty-icon">📦</div>
                                            <h3>{searchTerm ? `No se encontraron productos para "${searchTerm}"` : 'No hay productos aún'}</h3>
                                            <p>{searchTerm ? 'Prueba a buscar con otra palabra clave.' : 'Crea tu primer producto para empezar a vender'}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Core Product Form Modal */}
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

            {/* Relations Form Modal */}
            {isRelationsModalOpen && relationsProduct && (
                <div className="admin-modal-overlay" onClick={closeRelationsModal} style={{ zIndex: 1000, alignContent: 'center' }}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                Sugerencias de Compra
                            </h2>
                            <button className="admin-modal-close" type="button" onClick={closeRelationsModal}>×</button>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            Configura aquí las relaciones para el producto: <strong>{relationsProduct.product_translations[0]?.name || relationsProduct.slug}</strong>
                        </p>

                        <form onSubmit={handleRelationsSave} className="admin-form" style={{ padding: 0, border: 'none', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Ventas Cruzadas (Cross-Selling)</label>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Selecciona accesorios, consumibles o productos relacionados ("Frecuentemente comprados juntos").</p>
                                <select multiple value={crossSells} onChange={(e) => handleSelectMultiple(e, setCrossSells)} style={{ width: '100%', minHeight: '150px', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '1rem' }} className="admin-input form-input">
                                    {products.filter(p => p.id !== relationsProduct.id).map((p: any) => (
                                        <option key={p.id} value={p.id} style={{ padding: '0.4rem', cursor: 'pointer' }}>{p.product_translations[0]?.name || p.slug} ({p.sku})</option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>* Mantén presionado Cmd (Mac) o Ctrl (Windows) para seleccionar múltiples.</p>
                            </div>

                            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Mejora Premium (Up-Selling)</label>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Selecciona alternativas superiores, modelos mejores o versiones Premium ("Quizás te interese esto en su lugar").</p>
                                <select multiple value={upSells} onChange={(e) => handleSelectMultiple(e, setUpSells)} style={{ width: '100%', minHeight: '150px', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '1rem' }} className="admin-input form-input">
                                    {products.filter(p => p.id !== relationsProduct.id).map((p: any) => (
                                        <option key={p.id} value={p.id} style={{ padding: '0.4rem', cursor: 'pointer' }}>{p.product_translations[0]?.name || p.slug} ({p.sku})</option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>* Mantén presionado Cmd (Mac) o Ctrl (Windows) para seleccionar múltiples.</p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeRelationsModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isRelationsLoading}>
                                    {isRelationsLoading ? 'Guardando...' : 'Guardar y Sincronizar'}
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
                        <p className="py-4">¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer y podría afectar a pedidos existentes.</p>
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
