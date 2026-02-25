import prisma from '@/lib/db';
import PaymentsManager from './PaymentsManager';

async function getPaymentMethods() {
    return prisma.paymentMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { payment_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function PaymentsPage() {
    const methods = await getPaymentMethods();

    return <PaymentsManager methods={methods} />;
}
