import prisma from '@/lib/db';
import SettingsForm from './SettingsForm';

async function getSettings() {
    return prisma.siteSetting.findMany();
}

export default async function SettingsPage() {
    const settings = await getSettings();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Configuración Global y Módulos</h1>
            </div>
            <div className="admin-page">
                <SettingsForm initialSettings={settings} />
            </div>
        </>
    );
}
