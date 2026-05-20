import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import CookieConsent from '@/components/storefront/CookieConsent';
import AnalyticsScripts from '@/components/storefront/AnalyticsScripts';
import { CartProvider } from '@/context/CartContext';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function StorefrontLayout({ children, params }: Props) {
    // Cargar todos los SiteSettings necesarios para el chrome de la storefront
    // en una sola query.
    const [settings, session] = await Promise.all([
        prisma.siteSetting.findMany({
            where: { key: { in: ['storefront_theme', 'analytics_ga4_id', 'analytics_meta_pixel_id', 'cookies_policy_url'] } }
        }),
        auth()
    ]);
    const get = (k: string) => settings.find((s) => s.key === k)?.value || '';

    const theme = get('storefront_theme') || 'default';
    const internalThemes = ['default', 'elegant-dark', 'eco-nature', 'vibrant-tech', 'pastel-breeze'];
    const isCustomTheme = !internalThemes.includes(theme);

    return (
        <div className="flex flex-col min-h-screen" data-theme={theme}>
            {isCustomTheme && <link rel="stylesheet" href={`/themes/${theme}.css`} />}
            {/* "Skip to content" — sólo visible al hacer focus con teclado. */}
            <a href="#main-content" className="skip-to-content">Saltar al contenido</a>
            {/* userId habilita la fusión carrito anónimo ↔ DB en el provider. */}
            <CartProvider userId={session?.user?.id}>
                <Header />
                <main id="main-content" tabIndex={-1} className="storefront-main">{children}</main>
                <Footer />
            </CartProvider>

            {/* RGPD: banner de consent + carga condicional de analytics/marketing. */}
            <CookieConsent policyUrl={get('cookies_policy_url') || '/cookies'} />
            <AnalyticsScripts
                gaId={get('analytics_ga4_id') || undefined}
                metaPixelId={get('analytics_meta_pixel_id') || undefined}
            />
        </div>
    );
}
