import prisma from '@/lib/db';

import ShippingManager from './ShippingManager';

async function getShippingMethods() {
    return prisma.shippingMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { shipping_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function ShippingPage() {
    const methods = await getShippingMethods();
    return <ShippingManager initialMethods={methods} />;
}
