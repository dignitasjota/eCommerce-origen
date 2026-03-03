import prisma from './src/lib/db';
async function run() {
    const pages = await prisma.page.findMany();
    console.log("PAGES ARE:", pages);
}
run();
