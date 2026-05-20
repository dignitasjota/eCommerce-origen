import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import UsersManager from './UsersManager';
import AdminPagination from '@/components/backoffice/AdminPagination';

const PER_PAGE = 25;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function UsersPage({ params, searchParams }: Props) {
    const { locale } = await params;
    const sp = await searchParams;

    const pageRaw = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = (page - 1) * PER_PAGE;

    const q = typeof sp.q === 'string' ? sp.q.trim() : undefined;
    const where: Prisma.UserWhereInput = q
        ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
        : {};

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: PER_PAGE,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                created_at: true,
                _count: { select: { orders: true } },
                addresses: {
                    where: { is_default: true },
                    take: 1
                }
            }
        }),
        prisma.user.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const basePath = locale === 'es' ? '/admin/users' : `/${locale}/admin/users`;

    return (
        <>
            <UsersManager initialUsers={users} />
            <AdminPagination basePath={basePath} page={page} totalPages={totalPages} extraParams={{ q }} />
        </>
    );
}
