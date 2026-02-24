import AdminLayoutClient from '@/components/backoffice/AdminLayoutClient';
import prisma from '@/lib/db';

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
