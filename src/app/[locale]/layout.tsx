import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/navigation';
import { Metadata } from 'next';
import prisma from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
    const settingsList = await prisma.siteSetting.findMany({
        where: { key: { in: ['site_name', 'site_favicon', 'seo_default_title', 'seo_default_description', 'seo_twitter_handle'] } }
    });

    const settings = settingsList.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    const siteName = settings['site_name'] || 'eShop';
    const title = settings['seo_default_title'] || siteName;
    const description = settings['seo_default_description'] || 'Bienvenido a nuestra tienda online.';
    const twitterHandle = settings['seo_twitter_handle'] || '@eshop';

    return {
        title: {
            template: `%s | ${siteName}`,
            default: title
        },
        description: description,
        openGraph: {
            title: title,
            description: description,
            siteName: siteName,
            type: 'website'
        },
        twitter: {
            card: 'summary_large_image',
            site: twitterHandle,
            title: title,
            description: description,
        },
        icons: {
            icon: settings['site_favicon'] || '/favicon.ico',
        }
    };
}

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as 'es' | 'en')) {
        // DIAGNÓSTICO TEMPORAL — ver qué locale recibe el layout
        return (
            <html lang="es">
                <body style={{ background: '#ff6600', color: '#fff', padding: '40px', fontFamily: 'monospace' }}>
                    <h1>LAYOUT DIAGNOSTIC</h1>
                    <p><b>locale recibido:</b> "{locale}"</p>
                    <p><b>routing.locales:</b> {JSON.stringify(routing.locales)}</p>
                    <p><b>URL completa:</b> Revisa la barra de dirección del navegador</p>
                    <p><b>typeof locale:</b> {typeof locale}</p>
                    <p><b>locale.length:</b> {locale.length}</p>
                    <p><b>locale charCodes:</b> {Array.from(locale).map(c => c.charCodeAt(0)).join(', ')}</p>
                </body>
            </html>
        );
    }

    setRequestLocale(locale);
    const messages = await getMessages();

    return (
        <html lang={locale} data-theme="default">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body>
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
