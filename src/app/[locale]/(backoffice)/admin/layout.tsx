import AdminLayoutClient from '@/components/backoffice/AdminLayoutClient';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminLayoutClient>
            {children}
        </AdminLayoutClient>
    );
}
