import prisma from '@/lib/db';

async function getUsers() {
    return prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        select: { id: true, name: true, email: true, role: true, phone: true, created_at: true, _count: { select: { orders: true } } },
    });
}

export default async function UsersPage() {
    const users = await getUsers();

    const roleLabels: Record<string, string> = { ADMIN: 'Admin', ORDER_MANAGER: 'Gestor', CUSTOMER: 'Cliente' };
    const roleColors: Record<string, string> = { ADMIN: 'purple', ORDER_MANAGER: 'blue', CUSTOMER: '' };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Usuarios</h1>
            </div>
            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{users.length} usuarios</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr><th>Usuario</th><th>Email</th><th>Teléfono</th><th>Rol</th><th>Pedidos</th><th>Registrado</th></tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
                                    <td>{u.email}</td>
                                    <td style={{ fontSize: '0.8rem' }}>{u.phone || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${roleColors[u.role] || 'active'}`} style={u.role === 'ADMIN' ? { background: 'rgba(168,85,247,0.1)', color: '#a855f7' } : u.role === 'ORDER_MANAGER' ? { background: 'rgba(59,130,246,0.1)', color: '#3b82f6' } : {}}>
                                            {roleLabels[u.role]}
                                        </span>
                                    </td>
                                    <td>{u._count.orders}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {new Date(u.created_at).toLocaleDateString('es-ES')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
