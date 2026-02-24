import prisma from '@/lib/db';

async function getShippingMethods() {
    return prisma.shippingMethod.findMany({
        orderBy: { sort_order: 'asc' },
        include: { shipping_method_translations: { where: { locale: 'es' } } },
    });
}

export default async function ShippingPage() {
    const methods = await getShippingMethods();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Métodos de Envío</h1>
            </div>
            <div className="admin-page">
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr><th>Método</th><th>Precio</th><th>Gratis desde</th><th>Peso</th><th>Plazo</th><th>Estado</th></tr>
                        </thead>
                        <tbody>
                            {methods.map((m) => {
                                const t = m.shipping_method_translations[0];
                                return (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.name || '—'}</td>
                                        <td>{Number(m.price) === 0 ? 'Gratis' : `${Number(m.price).toFixed(2)}€`}</td>
                                        <td>{m.free_above ? `${Number(m.free_above)}€` : '—'}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{m.min_weight || m.max_weight ? `${m.min_weight || 0}–${m.max_weight || '∞'} kg` : '—'}</td>
                                        <td>{m.estimated_days ? `${m.estimated_days} días` : '—'}</td>
                                        <td><span className={`admin-badge ${m.is_active ? 'active' : 'inactive'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
