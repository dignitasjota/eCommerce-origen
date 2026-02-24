import prisma from '@/lib/db';
import Link from 'next/link';

async function getProducts() {
    return prisma.product.findMany({
        orderBy: { created_at: 'desc' },
        include: {
            product_translations: { where: { locale: 'es' } },
            product_categories: {
                include: {
                    categories: {
                        include: { category_translations: { where: { locale: 'es' } } },
                    },
                },
            },
            product_variants: true,
            product_images: { take: 1, orderBy: { sort_order: 'asc' } },
        },
    });
}

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Productos</h1>
                <div className="admin-topbar-actions">
                    <Link href="/es/admin/products/new" className="admin-btn admin-btn-primary">
                        + Nuevo Producto
                    </Link>
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
                                <th>Precio</th>
                                <th>Categoría</th>
                                <th>Variantes</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => {
                                const translation = product.product_translations[0];
                                const category = product.product_categories[0]?.categories?.category_translations[0];
                                const image = product.product_images[0];

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
                                        <td style={{ fontWeight: 600 }}>{Number(product.price).toFixed(2)}€</td>
                                        <td>{category?.name || '—'}</td>
                                        <td>{product.product_variants.length}</td>
                                        <td>
                                            <span className={`admin-badge ${product.is_active ? 'active' : 'inactive'}`}>
                                                {product.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <Link href={`/es/admin/products/${product.id}/edit`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar
                                                </Link>
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
        </>
    );
}
