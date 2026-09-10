import prisma from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

import CouponsManager from './CouponsManager';

async function getCoupons() {
    return prisma.coupon.findMany({ orderBy: { created_at: 'desc' } });
}

export default async function CouponsPage() {
    if (!(await hasPermission('coupons.manage'))) notFound();

    const coupons = await getCoupons();
    return <CouponsManager initialCoupons={coupons} />;
}
