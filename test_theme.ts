import prisma from './src/lib/db';

async function main() {
    await prisma.siteSetting.upsert({
        where: { key: 'storefront_theme' },
        update: { value: 'eco-nature' },
        create: { key: 'storefront_theme', value: 'eco-nature', type: 'string' }
    });
    console.log("Theme updated to eco-nature");
}
main();
