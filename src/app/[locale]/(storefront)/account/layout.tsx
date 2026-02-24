import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth'; // Ensure you have auth configured

import prisma from '@/lib/db';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const t = await getTranslations('nav'); // Assuming translations are there

    // Fase 11: Feature Flags (Wishlist toggle)
    const wishlistSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_wishlist_enabled' }
    });
    const isWishlistEnabled = wishlistSetting ? wishlistSetting.value === 'true' : true;

    if (!session || !session.user) {
        // Redirigir al login si no está autenticado
        // Dependiendo de tu config, puede ser /auth/login
        redirect('/es/auth/login');
    }

    return (
        <div className="container" style={{ padding: '4rem 1rem', display: 'flex', gap: '2rem' }}>
            {/* Sidebar Navigation */}
            <aside style={{ width: '250px', flexShrink: 0 }}>
                <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        Mi Cuenta
                    </h2>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <Link href="/account/profile" className="btn btn-outline" style={{ justifyContent: 'flex-start', border: 'none' }}>
                            Mi Perfil
                        </Link>
                        <Link href="/account/orders" className="btn btn-outline" style={{ justifyContent: 'flex-start', border: 'none' }}>
                            Mis Pedidos
                        </Link>
                        <Link href="/account/addresses" className="btn btn-outline" style={{ justifyContent: 'flex-start', border: 'none' }}>
                            Mis Direcciones
                        </Link>
                        {isWishlistEnabled && (
                            <Link href="/account/wishlist" className="btn btn-outline" style={{ justifyContent: 'flex-start', border: 'none' }}>
                                Lista de Deseos
                            </Link>
                        )}
                        <button className="btn btn-outline" style={{ justifyContent: 'flex-start', border: 'none', color: 'var(--color-danger)', marginTop: '2rem' }}>
                            Cerrar Sesión
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Main Content Area */}
            <main style={{ flex: 1 }}>
                {children}
            </main>
        </div>
    );
}
