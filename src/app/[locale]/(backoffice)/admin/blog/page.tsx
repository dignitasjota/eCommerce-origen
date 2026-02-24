import prisma from '@/lib/db';
import Link from 'next/link';

async function getBlogPosts() {
    return prisma.blogPost.findMany({
        orderBy: { created_at: 'desc' },
        include: { blog_post_translations: { where: { locale: 'es' } } },
    });
}

export default async function BlogPage() {
    const posts = await getBlogPosts();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Blog</h1>
                <div className="admin-topbar-actions">
                    <Link href="/es/admin/blog/new" className="admin-btn admin-btn-primary">+ Nuevo Artículo</Link>
                </div>
            </div>
            <div className="admin-page">
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr><th>Título</th><th>Slug</th><th>Estado</th><th>Publicado</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {posts.map((p) => {
                                const t = p.blog_post_translations[0];
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{t?.title || p.slug}</td>
                                        <td><code style={{ fontSize: '0.8rem', background: 'var(--color-background)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{p.slug}</code></td>
                                        <td><span className={`admin-badge ${p.is_published ? 'active' : 'inactive'}`}>{p.is_published ? 'Publicado' : 'Borrador'}</span></td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{p.published_at ? new Date(p.published_at).toLocaleDateString('es-ES') : '—'}</td>
                                        <td><Link href={`/es/admin/blog/${p.id}/edit`} className="admin-btn admin-btn-secondary admin-btn-sm">Editar</Link></td>
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
