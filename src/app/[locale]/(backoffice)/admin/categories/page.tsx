import prisma from '@/lib/db';
import Link from 'next/link';

async function getCategories() {
    return prisma.category.findMany({
        orderBy: { sort_order: 'asc' },
        include: {
            category_translations: { where: { locale: 'es' } },
            categories: {
                select: { category_translations: { where: { locale: 'es' }, select: { name: true } } },
            },
            other_categories: {
                include: { category_translations: { where: { locale: 'es' } } },
                orderBy: { sort_order: 'asc' },
            },
            _count: { select: { product_categories: true } },
        },
    });
}

export default async function CategoriesPage() {
    const categories = await getCategories();
    const parentCategories = categories.filter(c => !c.parent_id);

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Categorías</h1>
                <div className="admin-topbar-actions">
                    <Link href="/es/admin/categories/new" className="admin-btn admin-btn-primary">
                        + Nueva Categoría
                    </Link>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{categories.length} categorías</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Categoría</th>
                                <th>Slug</th>
                                <th>Padre</th>
                                <th>Productos</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parentCategories.map((cat) => {
                                const t = cat.category_translations[0];
                                return (
                                    <>
                                        <tr key={cat.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {cat.image && <span style={{ marginRight: 8 }}>🖼</span>}
                                                {t?.name || cat.slug}
                                            </td>
                                            <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{cat.slug}</code></td>
                                            <td>—</td>
                                            <td>{cat._count.product_categories}</td>
                                            <td>
                                                <span className={`admin-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                                                    {cat.is_active ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td>
                                                <Link href={`/es/admin/categories/${cat.id}/edit`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                    Editar
                                                </Link>
                                            </td>
                                        </tr>
                                        {cat.other_categories.map((sub) => {
                                            const st = sub.category_translations[0];
                                            return (
                                                <tr key={sub.id}>
                                                    <td style={{ paddingLeft: '2.5rem', color: 'var(--color-text-secondary)' }}>
                                                        ↳ {st?.name || sub.slug}
                                                    </td>
                                                    <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{sub.slug}</code></td>
                                                    <td>{t?.name}</td>
                                                    <td>{/* sub count needs separate query */}—</td>
                                                    <td>
                                                        <span className={`admin-badge ${sub.is_active ? 'active' : 'inactive'}`}>
                                                            {sub.is_active ? 'Activa' : 'Inactiva'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <Link href={`/es/admin/categories/${sub.id}/edit`} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                            Editar
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
