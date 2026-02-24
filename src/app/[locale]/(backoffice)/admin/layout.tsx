import AdminSidebar from '@/components/backoffice/AdminSidebar';
import '@/styles/backoffice.css';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-content">
                {children}
            </main>
        </div>
    );
}
