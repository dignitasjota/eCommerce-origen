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
    { key: 'invoice_series', value: 'A', type: 'string' }
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
    const plainPassword = process.env.ADMIN_PASSWORD || 'changeme-' + Math.random().toString(36).slice(2, 10);
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

async function main() {
    console.log('🌱 Bootstrap seed:');
    await ensureSettings();
    await ensureRootCategory();
    await ensureAdmin();
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
