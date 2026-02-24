import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';

export const metadata = {
    title: 'Blog | eShop',
    description: 'Noticias, novedades y artículos de interés',
};

type Props = {
    params: Promise<{ locale: string }>;
};

export default async function BlogPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('nav');

    // Fase 11: Feature Flags Server-Side Protection
    const blogSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_blog_enabled' }
    });
    if (blogSetting && blogSetting.value === 'false') {
        notFound();
    }

    // Fetch published blog posts
    const posts = await prisma.blogPost.findMany({
        where: { is_published: true },
        include: {
            blog_post_translations: {
                where: { locale }
            }
        },
        orderBy: {
            published_at: 'desc'
        }
    });

    const formattedPosts = posts.map(post => {
        const translation = post.blog_post_translations[0];
        return {
            id: post.id,
            slug: post.slug,
            image: post.image,
            published_at: post.published_at,
            title: translation?.title || post.slug,
            excerpt: translation?.excerpt || ''
        };
    });

    return (
        <div className="container" style={{ padding: '4rem 1rem' }}>
            <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>Nuestro Blog</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
                    Descubre las últimas novedades, guías y noticias del sector.
                </p>
            </header>

            {formattedPosts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                    {formattedPosts.map((post, index) => (
                        <Link
                            key={post.id}
                            href={`/blog/${post.slug}`}
                            className={`card animate-fade-in-up stagger-${(index % 12) + 1}`}
                            style={{ display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit' }}
                        >
                            <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: 'var(--color-background-soft)', overflow: 'hidden' }}>
                                {post.image ? (
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                        className="hover-scale"
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2 }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                            <circle cx="9" cy="9" r="2" />
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', marginBottom: '0.5rem' }}>
                                    {post.published_at ? new Date(post.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Pronto'}
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', lineHeight: '1.4' }}>
                                    {post.title}
                                </h3>
                                <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5', flexGrow: 1, marginBottom: '1.5rem' }}>
                                    {post.excerpt}
                                </p>
                                <span style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '0.9rem', marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Leer artículo
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No hay artículos publicados</h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Vuelve pronto para leer nuestras novedades.</p>
                </div>
            )}
        </div>
    );
}
