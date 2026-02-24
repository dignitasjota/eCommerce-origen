'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/backoffice/AdminSidebar';
import '@/styles/backoffice.css';

export default function AdminLayoutClient({
    children,
    siteName = 'eShop',
}: {
    children: React.ReactNode;
    siteName?: string;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="admin-layout">
            <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} siteName={siteName} />

            {/* Overlay for mobile when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="admin-sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <main className="admin-content">
                {/* Mobile Top Bar just for the hamburger menu when sidebar is closed */}
                <div className="admin-mobile-header">
                    <button
                        className="admin-mobile-toggle"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{siteName} Admin</span>
                </div>
                {children}
            </main>
        </div>
    );
}
