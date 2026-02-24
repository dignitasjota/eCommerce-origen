import prisma from '@/lib/db';
import Link from 'next/link';

import CouponsManager from './CouponsManager';

async function getCoupons() {
    return prisma.coupon.findMany({ orderBy: { created_at: 'desc' } });
}

export default async function CouponsPage() {
    const coupons = await getCoupons();
    return <CouponsManager initialCoupons={coupons} />;
}
