import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import { CartProvider } from '@/context/CartContext';
import prisma from '@/lib/db';

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function StorefrontLayout({ children, params }: Props) {
    // locale se carga internamente en el Server Component Header
    const themeSetting = await prisma.siteSetting.findUnique({
        where: { key: 'storefront_theme' }
    });
    const theme = themeSetting?.value || 'default';
    const internalThemes = ['default', 'elegant-dark', 'eco-nature', 'vibrant-tech', 'pastel-breeze'];
    const isCustomTheme = !internalThemes.includes(theme);

    return (
        <div className="flex flex-col min-h-screen" data-theme={theme}>
            {isCustomTheme && <link rel="stylesheet" href={`/themes/${theme}.css`} />}
            <CartProvider>
                <Header />
                <main className="storefront-main">{children}</main>
                <Footer />
            </CartProvider>
        </div>
    );
}
