import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/navigation';
import { Metadata } from 'next';
import prisma from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
    const settingsList = await prisma.siteSetting.findMany({
        where: { key: { in: ['site_name', 'site_favicon'] } }
    });

    const settings = settingsList.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    return {
        title: {
            template: `%s | ${settings['site_name'] || 'eShop'}`,
            default: settings['site_name'] || 'eShop'
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
        notFound();
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
