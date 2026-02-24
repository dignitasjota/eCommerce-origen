import prisma from '@/lib/db';

import LegalManager from './LegalManager';

async function getLegalPages() {
    return prisma.legalPage.findMany({
        include: { legal_page_translations: { where: { locale: 'es' } } },
    });
}

export default async function LegalPage() {
    const pages = await getLegalPages();
    return <LegalManager initialPages={pages} />;
}
