import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

import LegalManager from './LegalManager';

async function getLegalPages() {
    return prisma.legalPage.findMany({
        include: { legal_page_translations: { where: { locale: 'es' } } },
    });
}

export default async function LegalPage() {
    if (!(await hasPermission('legal.manage'))) notFound();

    const pages = await getLegalPages();
    return <LegalManager initialPages={pages} />;
}
