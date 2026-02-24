import prisma from '@/lib/db';
import Link from 'next/link';

async function getCoupons() {
    return prisma.coupon.findMany({ orderBy: { created_at: 'desc' } });
}

export default async function CouponsPage() {
    const coupons = await getCoupons();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Cupones</h1>
                <div className="admin-topbar-actions">
                    <Link href="/es/admin/coupons/new" className="admin-btn admin-btn-primary">+ Nuevo Cupón</Link>
                </div>
            </div>
            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{coupons.length} cupones</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Tipo</th>
                                <th>Valor</th>
                                <th>Compra mínima</th>
                                <th>Usos</th>
                                <th>Estado</th>
                                <th>Expira</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map((c) => (
                                <tr key={c.id}>
                                    <td><code style={{ fontSize: '0.85rem', fontWeight: 700, background: 'var(--color-background)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{c.code}</code></td>
                                    <td>{c.discount_type === 'PERCENTAGE' ? 'Porcentaje' : 'Fijo'}</td>
                                    <td style={{ fontWeight: 600 }}>{c.discount_type === 'PERCENTAGE' ? `${Number(c.discount_value)}%` : `${Number(c.discount_value)}€`}</td>
                                    <td>{c.min_purchase ? `${Number(c.min_purchase)}€` : '—'}</td>
                                    <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                                    <td><span className={`admin-badge ${c.is_active ? 'active' : 'inactive'}`}>{c.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-ES') : 'Sin expiración'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
