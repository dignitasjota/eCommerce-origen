import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';
import AddToCartClientButton from '@/components/storefront/AddToCartClientButton';

// Enlace personal — nunca debe indexarse ni aparecer en buscadores.
export const metadata = {
    title: 'Lista de deseos compartida | eShop',
    robots: { index: false, follow: false }
};

type Props = {
    params: Promise<{ locale: string; token: string }>;
};

export default async function SharedWishlistPage({ params }: Props) {
    const { locale, token } = await params;
    setRequestLocale(locale);

    const wishlistSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_wishlist_enabled' }
    });
    if (wishlistSetting && wishlistSetting.value === 'false') {
        notFound();
    }

    // Sólo el hash del token de 256 bits identifica al dueño — no hay lookup
    // por id de usuario ni se expone ningún otro dato salvo el nombre.
    const owner = await prisma.user.findUnique({
        where: { wishlist_share_token: token },
        select: { id: true, name: true }
    });
    if (!owner) {
        notFound();
    }

    const ownerFirstName = owner.name?.trim().split(/\s+/)[0] || 'un cliente';

    const dbWishlist = await prisma.wishlistItem.findMany({
        where: { user_id: owner.id },
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

    const formattedProducts = dbWishlist.map((w) => {
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
        <div className="container" style={{ padding: '4rem 1rem' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Lista de deseos de {ownerFirstName}</h1>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                    {formattedProducts.length} {formattedProducts.length === 1 ? 'producto' : 'productos'}
                </p>
            </header>

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
                                {!product.is_active && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                                        Agotado / No disponible
                                    </div>
                                )}
                                {product.image ? (
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                        style={{ objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                        <svg aria-hidden="true" focusable="false" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
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
                                {product.is_active && (
                                    <AddToCartClientButton product={{ id: product.id, name: product.name, price: product.price, image: product.image || undefined }} />
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <h2>Esta lista de deseos está vacía</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Vuelve más tarde, quizá {ownerFirstName} añada algo pronto.</p>
                </div>
            )}
        </div>
    );
}
