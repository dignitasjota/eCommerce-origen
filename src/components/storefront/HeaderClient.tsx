'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import CartDrawer from './CartDrawer';
import styles from './Header.module.css';

interface Category {
    id: string;
    slug: string;
    name: string;
}

interface HeaderClientProps {
    categories: Category[];
    features?: {
        blog: boolean;
        wishlist: boolean;
    };
}

export default function HeaderClient({ categories, features }: HeaderClientProps) {
    const t = useTranslations('nav');
    const pathname = usePathname();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const { state: cartState } = useCart();

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false);
    }, [pathname]);

    return (
        <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
            <div className={`container ${styles.headerInner}`}>
                {/* Logo */}
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoText}>eShop</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className={styles.nav}>
                    <Link href="/" className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}>
                        {t('home')}
                    </Link>
                    {categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/category/${cat.slug}`}
                            className={`${styles.navLink} ${pathname.startsWith(`/category/${cat.slug}`) ? styles.active : ''}`}
                        >
                            {cat.name}
                        </Link>
                    ))}
                    <Link href="/products" className={`${styles.navLink} ${pathname.startsWith('/products') ? styles.active : ''}`}>
                        Catálogo
                    </Link>
                    {features?.blog !== false && (
                        <Link href="/blog" className={`${styles.navLink} ${pathname.startsWith('/blog') ? styles.active : ''}`}>
                            Blog
                        </Link>
                    )}
                </nav>

                {/* Actions */}
                <div className={styles.actions}>
                    {/* Search Toggle */}
                    <button
                        className={styles.actionBtn}
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                        aria-label={t('searchPlaceholder')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </button>

                    {/* Wishlist */}
                    {features?.wishlist !== false && (
                        <Link href="/account/wishlist" className={styles.actionBtn} aria-label={t('wishlist')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                            </svg>
                        </Link>
                    )}

                    {/* Cart */}
                    <button onClick={() => setIsCartOpen(true)} className={styles.actionBtn} aria-label={t('cart')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="21" r="1" />
                            <circle cx="19" cy="21" r="1" />
                            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                        </svg>
                        <span className={styles.cartBadge}>{cartState.totalQuantity}</span>
                    </button>

                    {/* Account */}
                    <Link href="/auth/login" className={styles.actionBtn} aria-label={t('account')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </Link>

                    {/* Mobile Menu Toggle */}
                    <button
                        className={`${styles.menuToggle} ${isMobileMenuOpen ? styles.menuOpen : ''}`}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Menu"
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            {isSearchOpen && (
                <div className={styles.searchBar}>
                    <div className="container">
                        <form action="/products" className={styles.searchForm}>
                            <input
                                type="search"
                                name="q"
                                placeholder={t('searchPlaceholder')}
                                className={styles.searchInput}
                                autoFocus
                            />
                            <button type="submit" className="btn btn-primary">
                                {t('searchPlaceholder').split(' ')[0]}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className={styles.mobileMenu}>
                    <nav className={styles.mobileNav}>
                        <Link href="/" className={styles.mobileNavLink}>{t('home')}</Link>
                        {categories.map((cat) => (
                            <Link key={cat.id} href={`/category/${cat.slug}`} className={styles.mobileNavLink}>
                                {cat.name}
                            </Link>
                        ))}
                        <Link href="/products" className={styles.mobileNavLink}>Catálogo</Link>
                        {features?.blog !== false && (
                            <Link href="/blog" className={styles.mobileNavLink}>Blog</Link>
                        )}
                        <button onClick={() => { setIsMobileMenuOpen(false); setIsCartOpen(true); }} className={styles.mobileNavLink} style={{ background: 'transparent', border: 'none', textAlign: 'left', width: '100%', padding: '0.75rem 1rem', fontSize: '1.25rem' }}>{t('cart')} ({cartState.totalQuantity})</button>
                        {features?.wishlist !== false && (
                            <Link href="/account/wishlist" className={styles.mobileNavLink}>{t('wishlist')}</Link>
                        )}
                        <Link href="/auth/login" className={styles.mobileNavLink}>{t('login')}</Link>
                    </nav>
                </div>
            )}
            {/* Cart Drawer Slideover */}
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </header>
    );
}
