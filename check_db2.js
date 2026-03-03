const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const settings = await prisma.siteSetting.findMany({ where: { key: 'pages_prefix' } });
    console.log("pages_prefix is:", settings);
}
main().catch(console.error).finally(() => prisma.$disconnect());
