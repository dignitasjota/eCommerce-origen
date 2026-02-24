'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const navSections = [
    {
        title: 'General',
        items: [
            { href: '/es/admin/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        ],
    },
    {
        title: 'Catálogo',
        items: [
            { href: '/es/admin/products', label: 'Productos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { href: '/es/admin/categories', label: 'Categorías', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        ],
    },
    {
        title: 'Ventas',
        items: [
            { href: '/es/admin/orders', label: 'Pedidos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
            { href: '/es/admin/coupons', label: 'Cupones', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
        ],
    },
    {
        title: 'Configuración',
        items: [
            { href: '/es/admin/shipping', label: 'Envíos', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
            { href: '/es/admin/payments', label: 'Pagos', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { href: '/es/admin/settings', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        ],
    },
    {
        title: 'Contenido',
        items: [
            { href: '/es/admin/blog', label: 'Blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
            { href: '/es/admin/legal', label: 'Legal', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { href: '/es/admin/users', label: 'Usuarios', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        ],
    },
];

export default function AdminSidebar({ isOpen, setIsOpen, siteName = 'eShop' }: { isOpen: boolean; setIsOpen: (isOpen: boolean) => void; siteName?: string }) {
    const pathname = usePathname();

    return (
        <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
            <div className="admin-sidebar-header">
                <Link href="/es/admin/dashboard" className="admin-brand" onClick={() => setIsOpen(false)}>
                    <span className="admin-brand-logo">{siteName.charAt(0).toUpperCase()}</span>
                    <span className="admin-brand-text">{siteName} Admin</span>
                </Link>
                {/* Close Button Mobile only inside sidebar */}
                <button
                    className="admin-mobile-close"
                    onClick={() => setIsOpen(false)}
                >
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <nav className="admin-sidebar-nav">
                {navSections.map((section) => (
                    <div key={section.title} className="admin-sidebar-section">
                        <div className="admin-sidebar-section-title">{section.title}</div>
                        {section.items.map((item) => {
                            // Split locale prefix handling dynamically for multilanguage backoffices 
                            const itemPathWithoutLocale = item.href.replace(/^\/[a-z]{2}\//, '/');
                            const currentPathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, '/');

                            // Check exact match or sub-paths exactly. e.g /admin/products y /admin/products/new
                            const isActive = currentPathWithoutLocale === itemPathWithoutLocale || currentPathWithoutLocale.startsWith(itemPathWithoutLocale + '/');

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`admin-nav-link ${isActive ? 'active' : ''}`}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <svg className="admin-nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                                    </svg>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="admin-sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem' }}>
                <div className="admin-user-info" style={{ padding: 0, borderTop: 'none', background: 'transparent' }}>
                    <div className="admin-user-avatar">A</div>
                    <div className="admin-user-details">
                        <div className="admin-user-name">Admin</div>
                        <div className="admin-user-role">Administrador</div>
                    </div>
                </div>
                <button
                    onClick={() => signOut({ callbackUrl: '/es/auth/login' })}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    title="Cerrar sesión"
                >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </aside>
    );
}
