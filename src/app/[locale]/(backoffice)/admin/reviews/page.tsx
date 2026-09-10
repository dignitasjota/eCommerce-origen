import type { Prisma } from '@prisma/client';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import ReviewsManager from './ReviewsManager';
import AdminPagination from '@/components/backoffice/AdminPagination';

const PER_PAGE = 25;

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ReviewsPage({ params, searchParams }: Props) {
    if (!(await hasPermission('reviews.manage'))) notFound();

    const { locale } = await params;
    const sp = await searchParams;

    const pageRaw = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = (page - 1) * PER_PAGE;

    const status = sp.status === 'approved' || sp.status === 'all' ? sp.status : 'pending';
    const where: Prisma.ReviewWhereInput =
        status === 'pending' ? { is_approved: false } : status === 'approved' ? { is_approved: true } : {};

    const [reviews, total, pendingCount] = await Promise.all([
        prisma.review.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: PER_PAGE,
            include: {
                users: { select: { name: true, email: true } },
                products: { select: { slug: true, product_translations: { where: { locale: 'es' }, select: { name: true } } } }
            }
        }),
        prisma.review.count({ where }),
        prisma.review.count({ where: { is_approved: false } })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const basePath = locale === 'es' ? '/admin/reviews' : `/${locale}/admin/reviews`;

    return (
        <>
            <ReviewsManager initialReviews={reviews} status={status} pendingCount={pendingCount} />
            <AdminPagination basePath={basePath} page={page} totalPages={totalPages} extraParams={{ status }} />
        </>
    );
}
