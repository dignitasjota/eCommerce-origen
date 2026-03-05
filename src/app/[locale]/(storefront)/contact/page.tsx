import { setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import ContactForm from './ContactForm';

export const dynamic = 'force-dynamic';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);

    // Check if feature is enabled
    const contactSetting = await prisma.siteSetting.findUnique({
        where: { key: 'feature_contact_enabled' }
    });

    if (contactSetting && contactSetting.value === 'false') {
        notFound();
    }

    return (
        <div className="container py-16 md:py-24 max-w-4xl">
            <header className="mb-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-4">
                    Contacto
                </h1>
                <p className="text-lg text-[var(--color-text-secondary)]">
                    ¿Tienes alguna duda o consulta? Escríbenos y te responderemos lo antes posible.
                </p>
            </header>

            <div className="bg-[var(--color-surface)] p-8 md:p-12 rounded-3xl shadow-sm border border-[var(--color-border)]">
                <ContactForm />
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center border-t border-[var(--color-border)] pt-12">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                        📍
                    </div>
                    <h3 className="font-bold text-lg mb-1">Dirección</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">Calle Falsa 123, Madrid, España</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                        ✉️
                    </div>
                    <h3 className="font-bold text-lg mb-1">Email</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">hola@eshop.com</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                        📞
                    </div>
                    <h3 className="font-bold text-lg mb-1">Teléfono</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">+34 900 123 456</p>
                </div>
            </div>
        </div>
    );
}
