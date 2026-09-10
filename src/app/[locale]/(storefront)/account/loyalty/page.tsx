import { setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getLoyaltySettings } from '@/lib/loyalty';
import LoyaltyManager from './LoyaltyManager';

export const metadata = {
    title: 'Mis Puntos | eShop',
    description: 'Tu saldo e historial de puntos de fidelización'
};

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function LoyaltyPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);

    const loyaltySetting = await prisma.siteSetting.findUnique({ where: { key: 'loyalty_enabled' } });
    if (loyaltySetting?.value !== 'true') {
        notFound();
    }

    const session = await auth();
    if (!session?.user?.id) {
        redirect('/auth/login?callbackUrl=/account/loyalty');
    }

    const [user, transactions, settings] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.user.id }, select: { loyalty_points: true } }),
        prisma.loyaltyTransaction.findMany({
            where: { user_id: session.user.id },
            orderBy: { created_at: 'desc' },
            take: 50
        }),
        getLoyaltySettings(prisma)
    ]);

    return (
        <LoyaltyManager
            balance={user?.loyalty_points ?? 0}
            transactions={transactions.map((t) => ({
                id: t.id,
                type: t.type,
                points: t.points,
                note: t.note,
                created_at: t.created_at.toISOString()
            }))}
            pointValueCents={settings.pointValueCents}
        />
    );
}
