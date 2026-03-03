const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    let rawPage = await prisma.page.findMany({});
    console.log("pages: ", rawPage);
}
main().catch(console.error).finally(() => prisma.$disconnect());
