const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    let locale = 'es';
    let dynamicSlug = ['packs-ahorro'];

    const settingsMap = await prisma.siteSetting.findMany({
        where: { key: 'pages_prefix' }
    });
    console.log("settings:", settingsMap);

    const prefixSetting = settingsMap.find(s => s.key === 'pages_prefix');
    const prefix = prefixSetting ? prefixSetting.value : '';
    console.log("prefix is:", prefix);

    let pageSlug = null;
    if (prefix === '' && dynamicSlug.length === 1) {
        pageSlug = dynamicSlug[0];
    } else if (prefix !== '' && dynamicSlug.length === 2 && dynamicSlug[0] === prefix) {
        pageSlug = dynamicSlug[1];
    }
    console.log("resolved pageSlug:", pageSlug);

    if (pageSlug) {
        const page = await prisma.page.findUnique({
            where: { slug: pageSlug },
            include: { page_translations: true }
        });
        console.log("Found page:", page);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
