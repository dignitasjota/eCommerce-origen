import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import ProductEditForm from './ProductEditForm';
import VariantsManager from './VariantsManager';
import Link from 'next/link';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params;

    // Fetch the product being edited
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            product_translations: { where: { locale } },
            related_to: true,
            product_variants: { orderBy: { sku: 'asc' } }
        }
    });

    if (!product) notFound();

    // Fetch all other products for the selection dropdowns
    const allProducts = await prisma.product.findMany({
        where: { id: { not: id } },
        include: {
            product_translations: { where: { locale } }
        }
    });

    const formattedProducts = allProducts.map(p => ({
        id: p.id,
        name: p.product_translations[0]?.name || p.slug,
        sku: p.sku
    }));

    return (
        <div className="admin-page">
            <div className="admin-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href={`/${locale}/admin/products`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </Link>
                    <h1 className="admin-topbar-title">Editar Producto: {product.product_translations[0]?.name || product.slug}</h1>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
                <div style={{ padding: '2rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Variantes</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                        Cada variante tiene SKU, precio y stock independientes. Si el precio se deja vacío, hereda el del producto base ({Number(product.price).toFixed(2)} €).
                    </p>
                    <VariantsManager
                        productId={product.id}
                        productPrice={Number(product.price)}
                        initialVariants={product.product_variants.map((v) => ({
                            id: v.id,
                            sku: v.sku,
                            price: v.price !== null ? Number(v.price) : null,
                            stock: v.stock,
                            is_active: v.is_active
                        }))}
                    />
                </div>

                <div style={{ padding: '2rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Relaciones y Sugerencias</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2.5rem', lineHeight: '1.5' }}>Gestiona las asociaciones de este producto para los motores de Cross-Selling y Up-Selling. Las selecciones aparecerán automágicamente en la ficha del escaparate como sugerencias de compra.</p>

                    <ProductEditForm
                        productId={product.id}
                        existingRelations={product.related_to}
                        allProducts={formattedProducts}
                    />
                </div>
            </div>
        </div>
    );
}
