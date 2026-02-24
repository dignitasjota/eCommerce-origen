import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import WishlistButton from '@/components/storefront/WishlistButton';

export const metadata = {
    title: 'Mi Lista de Deseos | eShop',
    description: 'Tus productos guardados',
};

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function WishlistPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('account');

    const session = await auth();

    // Fase 11: Feature Flags Server-Side Protection
    const wishlistSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_wishlist_enabled' }
    });
    if (wishlistSetting && wishlistSetting.value === 'false') {
        notFound();
    }

    if (!session?.user?.id) {
        redirect('/auth/login?callbackUrl=/account/wishlist');
    }

    const dbWishlist = await prisma.wishlistItem.findMany({
        where: { user_id: session.user.id },
        include: {
            products: {
                include: {
                    product_translations: { where: { locale } },
                    product_images: { take: 1, orderBy: { sort_order: 'asc' } }
                }
            }
        },
        orderBy: { created_at: 'desc' }
    });

    const formattedProducts = dbWishlist.map(w => {
        const p = w.products;
        return {
            id: p.id,
            slug: p.slug,
            name: p.product_translations[0]?.name || p.slug,
            price: Number(p.price).toFixed(2),
            image: p.product_images[0]?.url || null,
            is_active: p.is_active
        };
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Mi Lista de Deseos</h1>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                    {formattedProducts.length} {formattedProducts.length === 1 ? 'producto' : 'productos'}
                </div>
            </div>

            {formattedProducts.length > 0 ? (
                <div className="product-grid" style={{ marginBottom: '3rem' }}>
                    {formattedProducts.map((product, index) => (
                        <Link
                            key={product.id}
                            href={`/product/${product.slug}`}
                            className={`card product-card animate-fade-in-up stagger-${(index % 12) + 1}`}
                            style={{ opacity: product.is_active ? 1 : 0.6 }}
                        >
                            <div className="card-image" style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: 'var(--color-background-soft)' }}>
                                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, padding: '0.4rem', backgroundColor: 'var(--color-background)', borderRadius: '50%', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <WishlistButton
                                        productId={product.id}
                                        initialIsFavorited={true}
                                    />
                                </div>
                                {!product.is_active && (
                                    <div style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                                        Agotado / No disponible
                                    </div>
                                )}
                                {product.image ? (
                                    <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                            <circle cx="9" cy="9" r="2" />
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="card-body">
                                <h3 className="card-title">{product.name}</h3>
                                <div style={{ marginTop: '0.5rem', fontWeight: '600', color: 'var(--color-primary)' }}>
                                    <span className="card-price">{product.price} €</span>
                                </div>
                                <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem' }} disabled={!product.is_active}>
                                    Ver producto
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--color-background)', borderRadius: '50%', marginBottom: '1.5rem' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                    </div>
                    <h2>No tienes productos guardados</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Añade artículos a tu lista de deseos pulsando el corazón en el catálogo.</p>
                    <Link href="/products" className="btn btn-primary" style={{ marginTop: '2rem' }}>Ir a comprar</Link>
                </div>
            )}
        </div>
    );
}
