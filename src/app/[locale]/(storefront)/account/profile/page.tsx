import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export default async function ProfilePage() {
    const session = await auth();
    const t = await getTranslations('nav'); // Fallback o cargar algo de perfil

    if (!session?.user?.email) {
        return null; // Layout ya redirige, esto es por si acaso para TS
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
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
                <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            Nombre Completo
                        </label>
                        <input
                            type="text"
                            name="name"
                            defaultValue={user.name || ''}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            name="email"
                            defaultValue={user.email || ''}
                            disabled
                            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                        />
                        <small style={{ color: 'var(--color-text-tertiary)', marginTop: '0.25rem', display: 'block' }}>
                            El correo no se puede cambiar.
                        </small>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn btn-primary">
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
