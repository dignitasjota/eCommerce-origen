import prisma from '@/lib/db';

async function getLegalPages() {
    return prisma.legalPage.findMany({
        include: { legal_page_translations: { where: { locale: 'es' } } },
    });
}

export default async function LegalPage() {
    const pages = await getLegalPages();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Páginas Legales</h1>
            </div>
            <div className="admin-page">
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr><th>Página</th><th>Slug</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {pages.map((p) => {
                                const t = p.legal_page_translations[0];
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.title || p.slug}</td>
                                        <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{p.slug}</code></td>
                                        <td><a href={`/es/admin/legal/${p.id}/edit`} className="admin-btn admin-btn-secondary admin-btn-sm">Editar</a></td>
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
