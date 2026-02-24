import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import styles from './Footer.module.css';
import prisma from '@/lib/db';

export default async function Footer() {
    const locale = await getLocale();
    const t = await getTranslations('footer');
    const tNav = await getTranslations('nav');
    const year = new Date().getFullYear();

    // Fase 9: Leer las páginas legales disponibles
    const [legalPages, dbSettings] = await Promise.all([
        prisma.legalPage.findMany({
            include: {
                legal_page_translations: {
                    where: { locale }
                }
            }
        }),
        prisma.siteSetting.findMany({
            where: { key: { in: ['feature_blog_enabled', 'feature_wishlist_enabled'] } }
        })
    ]);

    const isFeatureEnabled = (key: string) => {
        const setting = dbSettings.find(s => s.key === key);
        return setting ? setting.value === 'true' : true;
    };

    const features = {
        blog: isFeatureEnabled('feature_blog_enabled'),
        wishlist: isFeatureEnabled('feature_wishlist_enabled'),
    };

    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.footerInner}`}>
                {/* Brand */}
                <div className={styles.footerSection}>
                    <Link href="/" className={styles.footerLogo}>
                        <span className={styles.logoText}>eShop</span>
                    </Link>
                    <p className={styles.footerDescription}>
                        {t('aboutUs')}
                    </p>
                    <div className={styles.socialLinks}>
                        <a href="#" aria-label="Facebook" className={styles.socialLink}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </a>
                        <a href="#" aria-label="Instagram" className={styles.socialLink}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                            </svg>
                        </a>
                        <a href="#" aria-label="Twitter" className={styles.socialLink}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </a>
                    </div>
                </div>

                {/* Quick Links */}
                <div className={styles.footerSection}>
                    <h4 className={styles.footerTitle}>{tNav('shop')}</h4>
                    <ul className={styles.footerLinks}>
                        <li><Link href="/categories">{tNav('categories')}</Link></li>
                        <li><Link href="/products">{tNav('searchPlaceholder')}</Link></li>
                        {features.blog && <li><Link href="/blog">{tNav('blog')}</Link></li>}
                    </ul>
                </div>

                {/* Customer Service */}
                <div className={styles.footerSection}>
                    <h4 className={styles.footerTitle}>{t('customerService')}</h4>
                    <ul className={styles.footerLinks}>
                        <li><Link href="/account">{tNav('account')}</Link></li>
                        <li><Link href="/account/orders">{tNav('orders')}</Link></li>
                        {features.wishlist && <li><Link href="/account/wishlist">{tNav('wishlist')}</Link></li>}
                    </ul>
                </div>

                {/* Legal (Generado Dinámicamente Fase 9) */}
                <div className={styles.footerSection}>
                    <h4 className={styles.footerTitle}>{t('information')}</h4>
                    <ul className={styles.footerLinks}>
                        {legalPages.length > 0 ? (
                            legalPages.map(page => (
                                <li key={page.id}>
                                    <Link href={`/${page.slug}`}>
                                        {page.legal_page_translations[0]?.title || page.slug}
                                    </Link>
                                </li>
                            ))
                        ) : (
                            <>
                                <li><Link href="/privacy-policy">{t('privacyPolicy')}</Link></li>
                                <li><Link href="/terms-conditions">{t('termsConditions')}</Link></li>
                                <li><Link href="/cookie-policy">{t('cookiePolicy')}</Link></li>
                            </>
                        )}
                    </ul>
                </div>
            </div>

            {/* Bottom bar */}
            <div className={styles.footerBottom}>
                <div className="container">
                    <p className={styles.copyright}>
                        {t('copyright', { year: year.toString(), appName: 'eShop' })}
                    </p>
                </div>
            </div>
        </footer>
    );
}
