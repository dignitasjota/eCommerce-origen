import prisma from '@/lib/db';

import UsersManager from './UsersManager';

async function getUsers() {
    return prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        select: { id: true, name: true, email: true, role: true, phone: true, created_at: true, _count: { select: { orders: true } } },
    });
}

export default async function UsersPage() {
    const users = await getUsers();
    return <UsersManager initialUsers={users} />;
}
