import prisma from '@/lib/db';
import Link from 'next/link';

import OrdersList from './OrdersList';

async function getOrders() {
    return prisma.order.findMany({
        orderBy: { created_at: 'desc' },
        include: {
            users: { select: { name: true, email: true } },
            order_items: true,
            shipping_methods: { include: { shipping_method_translations: { where: { locale: 'es' } } } },
        },
    });
}

export default async function OrdersPage() {
    const orders = await getOrders();
    return <OrdersList initialOrders={orders} />;
}
