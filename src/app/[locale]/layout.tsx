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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    return {
        metadataBase: appUrl ? new URL(appUrl) : undefined,
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
        },
        // hreflang global para evitar duplicados es/en. Cada página puede
        // sobrescribir `alternates` con paths específicos del recurso.
        alternates: appUrl
            ? {
                  canonical: appUrl,
                  languages: {
                      es: `${appUrl}/`,
                      en: `${appUrl}/en/`,
                      'x-default': `${appUrl}/`
                  }
              }
            : undefined
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
