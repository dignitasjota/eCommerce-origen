/**
 * Catálogo mínimo para la suite e2e (CI y local). Idempotente.
 *
 * Sin esto, `seed-bootstrap.mjs` deja la BD sin productos ni métodos de envío
 * y el spec de checkout (03-checkout-cod) se marcaba `skipped` en CI: el flujo
 * más crítico de la tienda nunca se ejecutaba realmente.
 *
 * Requiere haber ejecutado antes seed-bootstrap.mjs (almacén MAIN).
 *   DATABASE_URL=... node ./scripts/dev/seed-e2e.mjs
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const url = (process.env.DATABASE_URL || '').replace(/^mysql:\/\//, 'mariadb://');
if (!url) {
    console.error('seed-e2e: DATABASE_URL ausente');
    process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

const PRODUCT_SKU = 'E2E-001';
const STOCK = 1000;

async function main() {
    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } });
    if (!warehouse) throw new Error('Almacén MAIN no encontrado — ejecuta antes seed-bootstrap.mjs');

    const category = await prisma.category.findFirst({ where: { parent_id: null } });

    let product = await prisma.product.findUnique({ where: { sku: PRODUCT_SKU } });
    if (!product) {
        product = await prisma.product.create({
            data: {
                slug: 'producto-e2e',
                sku: PRODUCT_SKU,
                price: 19.99,
                is_active: true,
                is_featured: true,
                unlimited_stock: false,
                product_translations: {
                    create: [
                        { locale: 'es', name: 'Producto E2E', description: '<p>Producto de pruebas automatizadas.</p>' },
                        { locale: 'en', name: 'E2E Product', description: '<p>Automated test product.</p>' }
                    ]
                },
                ...(category ? { product_categories: { create: { category_id: category.id } } } : {})
            }
        });
        console.log('  · producto E2E creado');
    }

    let variant = await prisma.productVariant.findUnique({ where: { sku: PRODUCT_SKU } });
    if (!variant) {
        variant = await prisma.productVariant.create({
            data: { product_id: product.id, sku: PRODUCT_SKU, price: 19.99, stock: 0 }
        });
    }

    // Stock repuesto en cada ejecución para que la suite pueda repetirse.
    await prisma.warehouseStock.upsert({
        where: { variant_id_warehouse_id: { variant_id: variant.id, warehouse_id: warehouse.id } },
        create: { variant_id: variant.id, warehouse_id: warehouse.id, stock: STOCK },
        update: { stock: STOCK }
    });
    const total = await prisma.warehouseStock.aggregate({ where: { variant_id: variant.id }, _sum: { stock: true } });
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: total._sum.stock ?? 0 } });

    const shipping = await prisma.shippingMethod.findFirst({ where: { is_active: true } });
    if (!shipping) {
        await prisma.shippingMethod.create({
            data: {
                price: 4.99,
                free_above: 50,
                is_active: true,
                sort_order: 0,
                estimated_days: '2-3 días',
                shipping_method_translations: {
                    create: [
                        { locale: 'es', name: 'Envío estándar' },
                        { locale: 'en', name: 'Standard shipping' }
                    ]
                }
            }
        });
        console.log('  · método de envío E2E creado');
    }

    console.log(`✅ Seed e2e listo (stock ${STOCK} en MAIN).`);
}

main()
    .catch((e) => {
        console.error('❌ seed-e2e error:', e?.message || e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
