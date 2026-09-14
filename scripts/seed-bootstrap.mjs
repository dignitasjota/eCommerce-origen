/**
 * Seed mínimo de bootstrap.
 * Se ejecuta automáticamente en cada arranque del contenedor (idempotente).
 *
 * Crea sólo lo IMPRESCINDIBLE para que la tienda arranque:
 *   - SiteSettings con valores por defecto.
 *   - Una categoría raíz "general" para que existan rutas /category/*.
 *   - El usuario admin inicial si la BD no tiene ningún ADMIN
 *     (credenciales desde ADMIN_EMAIL / ADMIN_PASSWORD; si no, defaults).
 *
 * Para datos demo (productos, blog, etc.) usar `seed-demo.mjs` aparte.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const url = (process.env.DATABASE_URL || '').replace(/^mysql:\/\//, 'mariadb://');
if (!url) {
    console.error('seed-bootstrap: DATABASE_URL ausente');
    process.exit(0); // no fatal
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

const DEFAULT_SETTINGS = [
    { key: 'site_name', value: 'eShop', type: 'string' },
    { key: 'storefront_theme', value: 'default', type: 'string' },
    { key: 'pages_prefix', value: '', type: 'string' },
    { key: 'currency', value: 'EUR', type: 'string' },
    { key: 'home_carousel_interval', value: '5000', type: 'number' },
    { key: 'feature_blog_enabled', value: 'true', type: 'boolean' },
    { key: 'feature_wishlist_enabled', value: 'true', type: 'boolean' },
    { key: 'feature_contact_enabled', value: 'true', type: 'boolean' },
    { key: 'seo_default_title', value: 'eShop — Tu tienda online', type: 'string' },
    { key: 'seo_default_description', value: 'Bienvenido a nuestra tienda online.', type: 'string' },
    { key: 'invoice_series', value: 'A', type: 'string' },
    { key: 'invoice_vat_rate', value: '21', type: 'number' }
];

async function ensureSettings() {
    let created = 0;
    for (const s of DEFAULT_SETTINGS) {
        const result = await prisma.siteSetting.upsert({
            where: { key: s.key },
            update: {}, // si ya existe, NO sobrescribimos (respetamos config del cliente)
            create: s
        });
        if (result) created++;
    }
    console.log(`  · ${created} ajustes verificados`);
}

async function ensureRootCategory() {
    const existing = await prisma.category.findFirst({ where: { parent_id: null } });
    if (existing) {
        console.log(`  · categoría raíz existente: ${existing.slug}`);
        return;
    }
    await prisma.category.create({
        data: {
            slug: 'general',
            sort_order: 0,
            is_active: true,
            category_translations: {
                create: [
                    { locale: 'es', name: 'General' },
                    { locale: 'en', name: 'General' }
                ]
            }
        }
    });
    console.log('  · categoría raíz "general" creada');
}

async function ensureAdmin() {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount > 0) {
        console.log(`  · ${adminCount} admin(s) ya en sistema`);
        return;
    }

    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    // Math.random() no es un PRNG criptográfico (potencialmente predecible) —
    // usamos randomBytes para la password autogenerada.
    const plainPassword = process.env.ADMIN_PASSWORD || 'changeme-' + randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await prisma.user.create({
        data: {
            email,
            password_hash: passwordHash,
            name: 'Administrator',
            role: 'ADMIN',
            is_active: true
        }
    });

    console.log('  ─────────────────────────────────────────────');
    console.log('  · ADMIN INICIAL CREADO');
    console.log(`    email:    ${email}`);
    console.log(`    password: ${plainPassword}`);
    console.log('    ⚠️  CAMBIA LA CONTRASEÑA EN EL PRIMER LOGIN.');
    console.log('  ─────────────────────────────────────────────');
}

/**
 * Garantiza que exista al menos un almacén activo (el checkout de
 * src/lib/warehouse.ts necesita uno para asignar stock) y migra el stock
 * de variantes que aún no tengan desglose por almacén (`WarehouseStock`) —
 * típicamente todas las variantes creadas ANTES de que multi-warehouse
 * existiera. Idempotente: en arranques posteriores no encuentra variantes
 * sin desglose y no hace nada.
 */
async function ensureDefaultWarehouseAndBackfillStock() {
    let mainWarehouse = await prisma.warehouse.findFirst({ where: { code: 'MAIN' } });
    if (!mainWarehouse) {
        mainWarehouse = await prisma.warehouse.create({
            data: { name: 'Almacén principal', code: 'MAIN', priority: 0, is_active: true }
        });
        console.log('  · almacén "Almacén principal" (MAIN) creado');
    } else {
        console.log('  · almacén principal ya existe');
    }

    const variantsWithoutWarehouseStock = await prisma.productVariant.findMany({
        where: { warehouse_stocks: { none: {} } },
        select: { id: true, stock: true }
    });
    if (variantsWithoutWarehouseStock.length > 0) {
        await prisma.warehouseStock.createMany({
            data: variantsWithoutWarehouseStock.map((v) => ({
                variant_id: v.id,
                warehouse_id: mainWarehouse.id,
                stock: v.stock
            })),
            skipDuplicates: true
        });
        console.log(`  · ${variantsWithoutWarehouseStock.length} variante(s) migradas al almacén principal`);
    } else {
        console.log('  · todas las variantes ya tienen desglose por almacén');
    }
}

/**
 * Fila singleton que ancla el encadenamiento de `InvoiceRecord` (Veri*Factu,
 * ver src/lib/verifactu.ts). Idempotente: `upsert` con update vacío no toca
 * `last_hash` si la fila ya existe (no queremos resetear la cadena en cada
 * arranque).
 */
async function ensureInvoiceChainState() {
    await prisma.invoiceChainState.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default', last_hash: null }
    });
    console.log('  · puntero de cadena de facturación (Veri*Factu) verificado');
}

async function main() {
    console.log('🌱 Bootstrap seed:');
    await ensureSettings();
    await ensureRootCategory();
    await ensureAdmin();
    await ensureDefaultWarehouseAndBackfillStock();
    await ensureInvoiceChainState();
    console.log('✅ Seed completado.');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e?.message || e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
