import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import WarehousesManager from './WarehousesManager';

async function getWarehouses() {
    return prisma.warehouse.findMany({
        orderBy: [{ priority: 'asc' }, { created_at: 'asc' }]
    });
}

export default async function WarehousesPage() {
    if (!(await hasPermission('warehouses.manage'))) notFound();

    const warehouses = await getWarehouses();
    return <WarehousesManager initialWarehouses={warehouses} />;
}
