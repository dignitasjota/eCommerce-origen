import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user?.email) {
        return null; // Layout ya redirige, esto es por si acaso para TS
    }

    // `select` explícito: evita traer `password_hash` a memoria del Server
    // Component cuando sólo hacen falta name/email/phone.
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { name: true, email: true, phone: true }
    });

    if (!user) {
        return <div>Usuario no encontrado</div>;
    }

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
                Mi Perfil
            </h1>

            <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '600px' }}>
                <ProfileForm name={user.name || ''} email={user.email || ''} phone={user.phone || ''} />
            </div>
        </div>
    );
}
