import prisma from '@/lib/db';

async function getPaymentMethods() {
    return prisma.paymentMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { payment_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function PaymentsPage() {
    const methods = await getPaymentMethods();

    const typeIcons: Record<string, string> = { stripe: '💳', paypal: '🅿️', cod: '💵' };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Métodos de Pago</h1>
            </div>
            <div className="admin-page">
                <div className="admin-stats-grid">
                    {methods.map((m) => {
                        const t = m.payment_method_translations[0];
                        return (
                            <div key={m.id} className="admin-stat-card" style={{ cursor: 'pointer' }}>
                                <div className="admin-stat-icon blue" style={{ fontSize: '1.5rem' }}>{typeIcons[m.type] || '💳'}</div>
                                <div className="admin-stat-info">
                                    <h3>{t?.name || m.type}</h3>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>{t?.description || ''}</div>
                                    <span className={`admin-badge ${m.is_active ? 'active' : 'inactive'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
