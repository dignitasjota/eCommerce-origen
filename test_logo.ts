import prisma from './src/lib/db';

async function main() {
    await prisma.siteSetting.upsert({
        where: { key: 'site_logo' },
        update: { value: '/uploads/abc.png' },
        create: { key: 'site_logo', value: '/uploads/abc.png', type: 'string' }
    });
    console.log("Logo updated");
}
main();
