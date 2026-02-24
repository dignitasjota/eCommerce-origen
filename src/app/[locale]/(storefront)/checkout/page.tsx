import { getLocale } from 'next-intl/server';
import prisma from '@/lib/db';
import CheckoutClient from './CheckoutClient';
import { auth } from '@/lib/auth';

export const metadata = {
    title: 'Checkout | eShop',
    description: 'Finaliza tu compra',
};

export default async function CheckoutPage() {
    const locale = await getLocale();
    const session = await auth();

    // Fetch active shipping methods with translations
    const dbShippingMethods = await prisma.shippingMethod.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        include: {
            shipping_method_translations: {
                where: { locale }
            }
        }
    });

    const shippingMethods = dbShippingMethods.map(method => ({
        id: method.id,
        price: Number(method.price),
        free_above: method.free_above ? Number(method.free_above) : null,
        name: method.shipping_method_translations[0]?.name || 'Método de Envío',
        description: method.shipping_method_translations[0]?.description || '',
        estimated_days: method.estimated_days || ''
    }));

    // Pre-fill user data if available
    let userAddress = null;
    let userEmail = session?.user?.email || '';
    let userName = session?.user?.name || '';

    if (session?.user?.id) {
        // Find default address
        const address = await prisma.address.findFirst({
            where: {
                user_id: session.user.id,
                is_default: true
            }
        });

        if (address) {
            userAddress = {
                firstName: address.first_name,
                lastName: address.last_name,
                address1: address.address1,
                address2: address.address2 || '',
                city: address.city,
                state: address.state || '',
                postalCode: address.postal_code,
                country: address.country,
                phone: address.phone || ''
            };
        }
    }

    return (
        <div className="container" style={{ padding: '3rem 1rem 6rem' }}>
            <CheckoutClient
                shippingMethods={shippingMethods}
                initialEmail={userEmail}
                initialName={userName}
                initialAddress={userAddress}
            />
        </div>
    );
}
