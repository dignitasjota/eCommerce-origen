import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import AddressesManager from './AddressesManager';

export default async function AddressesPage() {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    // `select` explícito: evita traer `password_hash` a memoria del Server
    // Component cuando sólo hace falta el id.
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
    });

    if (!user) {
        return <div>Usuario no encontrado</div>;
    }

    const addresses = await prisma.address.findMany({
        where: { user_id: user.id },
        orderBy: { is_default: 'desc' },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            address1: true,
            address2: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            phone: true,
            tax_id: true,
            is_default: true
        }
    });

    return <AddressesManager initialAddresses={addresses} />;
}
