import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import SettingsForm from './SettingsForm';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { getHeroAbStats } from '@/lib/ab-testing';

// Claves cuyo valor real NUNCA debe llegar al cliente: son secretos de pago/
// SMTP. `type="password"` en el input sólo enmascara la VISUALIZACIÓN — el
// valor seguía viajando íntegro en el payload RSC al navegador (visible por
// DevTools, o exfiltrable por un XSS futuro en el panel). En vez de eso, el
// servidor sólo informa de si CADA secreto ya está configurado (booleano);
// el formulario nunca ve el valor y sólo lo sobrescribe si el admin teclea
// uno nuevo (ver actions.ts).
const SENSITIVE_KEYS = new Set(['smtp_pass', 'stripe_secret_key', 'stripe_webhook_secret']);

async function getSettings() {
    return prisma.siteSetting.findMany();
}

export default async function SettingsPage() {
    // Nunca delegable: incluye claves de Stripe/SMTP (enmascaradas más abajo,
    // pero el resto de ajustes no) y branding/negocio completo. Sólo ADMIN.
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') notFound();

    const settings = await getSettings();
    const configuredSecrets = settings
        .filter((s) => SENSITIVE_KEYS.has(s.key) && s.value)
        .map((s) => s.key);
    const safeSettings = settings.map((s) => (SENSITIVE_KEYS.has(s.key) ? { ...s, value: '' } : s));

    const abHeroStats = await getHeroAbStats(prisma);

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
                <SettingsForm
                    initialSettings={safeSettings}
                    configuredSecrets={configuredSecrets}
                    customThemes={customThemes}
                    abHeroStats={abHeroStats}
                />
            </div>
        </>
    );
}
