const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    let pageSlug = 'packs-ahorro';
    const page = await prisma.page.findUnique({
        where: { slug: pageSlug },
        include: { page_translations: true }
    });
    console.log("Found page with page_translations:", page);
}
main().catch(console.error).finally(() => prisma.$disconnect());
