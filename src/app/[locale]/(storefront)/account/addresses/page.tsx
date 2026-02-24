import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export default async function AddressesPage() {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) {
        return <div>Usuario no encontrado</div>;
    }

    const addresses = await prisma.address.findMany({
        where: { user_id: user.id },
        orderBy: { is_default: 'desc' }
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    Mis Direcciones
                </h1>
                <button className="btn btn-primary">Nueva Dirección</button>
            </div>

            {addresses.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>No tienes direcciones guardadas.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {addresses.map((address) => (
                        <div key={address.id} style={{ backgroundColor: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: address.is_default ? '2px solid var(--color-primary)' : '1px solid transparent' }}>
                            {address.is_default && (
                                <span style={{ display: 'inline-block', backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                                    Predeterminada
                                </span>
                            )}
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{address.address1}</h3>
                            {address.address2 && <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{address.address2}</p>}
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{address.postal_code} {address.city}</p>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>{address.state}, {address.country}</p>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn btn-outline" style={{ flex: 1 }}>Editar</button>
                                <button className="btn btn-outline" style={{ flex: 1, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
