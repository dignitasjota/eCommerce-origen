import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { Link } from '@/i18n/navigation';

type Props = {
    params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { locale, slug } = await params;

    const post = await prisma.blogPost.findFirst({
        where: { slug, is_published: true },
        include: { blog_post_translations: { where: { locale } } }
    });

    if (!post) {
        return { title: 'Artículo no encontrado | eShop' };
    }

    const tData = post.blog_post_translations[0];
    const title = tData?.meta_title || tData?.title || 'Blog | eShop';
    const description = tData?.meta_description || tData?.excerpt || '';

    return {
        title: `${title} | eShop`,
        description,
        openGraph: {
            title,
            description,
            images: post.image ? [{ url: post.image }] : [],
            type: 'article',
            publishedTime: post.published_at?.toISOString(),
        }
    };
}

export default async function BlogPostPage({ params }: Props) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('nav');

    // Fase 11: Feature Flags Server-Side Protection
    const blogSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_blog_enabled' }
    });
    if (blogSetting && blogSetting.value === 'false') {
        notFound();
    }

    // Fetch the specific blog post
    const post = await prisma.blogPost.findFirst({
        where: { slug, is_published: true },
        include: {
            blog_post_translations: { where: { locale } }
        }
    });

    if (!post) {
        notFound();
    }

    const tData = post.blog_post_translations[0];
    const title = tData?.title || post.slug;
    const content = tData?.content || '';
    const excerpt = tData?.excerpt || '';

    return (
        <article className="container" style={{ padding: '2rem 1rem 5rem', maxWidth: '800px' }}>
            {/* Breadcrumbs */}
            <nav style={{ marginBottom: '3rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</Link>
                <span>/</span>
                <Link href="/blog" style={{ color: 'inherit', textDecoration: 'none' }}>Blog</Link>
                <span>/</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{title}</span>
            </nav>

            {/* Post Header */}
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--color-primary)', fontWeight: '600', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Pronto'}
                </div>

                <h1 style={{ fontSize: '3rem', fontWeight: 'bold', lineHeight: '1.2', marginBottom: '1.5rem' }}>
                    {title}
                </h1>

                {excerpt && (
                    <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', maxWidth: '650px', margin: '0 auto' }}>
                        {excerpt}
                    </p>
                )}
            </header>

            {/* Featured Image */}
            {post.image && (
                <div style={{ marginBottom: '4rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: 'var(--color-background-soft)', aspectRatio: '16/9' }}>
                    <img
                        src={post.image}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
            )}

            {/* Post Content */}
            <div
                className="blog-content"
                style={{
                    lineHeight: '1.8',
                    fontSize: '1.1rem',
                    color: 'var(--color-text-primary)'
                }}
                dangerouslySetInnerHTML={{ __html: content }}
            />

            {/* Post Footer CTA */}
            <footer style={{ marginTop: '5rem', paddingTop: '3rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/blog" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                    Volver al Blog
                </Link>

                {/* Opcional: Compartir en redes */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Compartir:</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} aria-label="Compartir en Twitter">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} aria-label="Compartir en Facebook">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} aria-label="Copiar enlace">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    </button>
                </div>
            </footer>
        </article>
    );
}
