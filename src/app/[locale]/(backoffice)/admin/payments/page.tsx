import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import PaymentsManager from './PaymentsManager';

async function getPaymentMethods() {
    return prisma.paymentMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { payment_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function PaymentsPage() {
    // Nunca delegable: configuración de pasarelas de pago. Sólo ADMIN.
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') notFound();

    const methods = await getPaymentMethods();

    return <PaymentsManager methods={methods} />;
}
