import prisma from '@/lib/db';

import PagesManager from './PagesManager';

async function getPages() {
    return prisma.page.findMany({
        include: { page_translations: { where: { locale: 'es' } } },
    });
}

export default async function PagesPage() {
    const pages = await getPages();
    const prefixSetting = await prisma.siteSetting.findUnique({ where: { key: 'pages_prefix' } });
    const prefix = prefixSetting ? prefixSetting.value : 'page';

    return <PagesManager initialPages={pages} pagesPrefix={prefix} />;
}
