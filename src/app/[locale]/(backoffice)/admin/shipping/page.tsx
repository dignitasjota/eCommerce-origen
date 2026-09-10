import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

import ShippingManager from './ShippingManager';

async function getShippingMethods() {
    return prisma.shippingMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { shipping_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function ShippingPage() {
    if (!(await hasPermission('shipping.manage'))) notFound();

    const methods = await getShippingMethods();
    return <ShippingManager initialMethods={methods} />;
}
