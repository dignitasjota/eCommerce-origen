import prisma from '@/lib/db';
import SettingsForm from './SettingsForm';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function getSettings() {
    return prisma.siteSetting.findMany();
}

export default async function SettingsPage() {
    const settings = await getSettings();
    let customThemes: string[] = [];
    try {
        const themesDir = join(process.cwd(), 'public', 'themes');
        const files = await readdir(themesDir);
        customThemes = files.filter(f => f.endsWith('.css')).map(f => f.replace('.css', ''));
    } catch (e) {
        // directory might not exist yet
    }

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Configuración Global y Módulos</h1>
            </div>
            <div className="admin-page">
                <SettingsForm initialSettings={settings} customThemes={customThemes} />
            </div>
        </>
    );
}
