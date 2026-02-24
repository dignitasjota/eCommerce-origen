import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import { CartProvider } from '@/context/CartContext';

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function StorefrontLayout({ children, params }: Props) {
    // locale se carga internamente en el Server Component Header
    return (
        <div className="flex flex-col min-h-screen">
            <CartProvider>
                <Header />
                <main className="storefront-main">{children}</main>
                <Footer />
            </CartProvider>
        </div>
    );
}
