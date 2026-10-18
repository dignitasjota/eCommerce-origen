import AdminLayoutClient from '@/components/backoffice/AdminLayoutClient';
import prisma from '@/lib/db';
import { Metadata } from 'next';

// El backoffice nunca debe prerenderizarse en build: este layout consulta la
// BD (site_settings) y, en el build de Docker (DATABASE_URL placeholder, sin
// BD), Next intentaba prerenderizar páginas como /admin/reviews antes de
// detectar el uso de la sesión → `pool timeout` y build roto.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: { template: '%s | Backoffice', default: 'Backoffice' },
    icons: {
        icon: '/favicon.ico', // Force default favicon for backoffice
    }
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const settings = await prisma.siteSetting.findMany({
        where: { key: { in: ['site_name', 'site_logo'] } }
    });

    const settingsMap = settings.reduce((acc, current) => {
        acc[current.key] = current.value;
        return acc;
    }, {} as Record<string, string>);

    const siteName = settingsMap['site_name'] || 'eShop';
    const siteLogo = settingsMap['site_logo'] || '';

    return (
        <AdminLayoutClient siteName={siteName} siteLogo={siteLogo}>
            {children}
        </AdminLayoutClient>
    );
}
