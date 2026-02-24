import AdminLayoutClient from '@/components/backoffice/AdminLayoutClient';
import prisma from '@/lib/db';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const siteNameSetting = await prisma.siteSetting.findUnique({ where: { key: 'site_name' } });
    const siteName = siteNameSetting?.value || 'eShop';

    return (
        <AdminLayoutClient siteName={siteName}>
            {children}
        </AdminLayoutClient>
    );
}
