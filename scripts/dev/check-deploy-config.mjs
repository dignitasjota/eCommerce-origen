#!/usr/bin/env node
/**
 * Comprobación rápida de configuración antes de un deploy.
 *
 * Uso:  node scripts/dev/check-deploy-config.mjs
 *
 * Verifica:
 *   1. Que existen las variables de entorno requeridas.
 *   2. Que la BD responde (conexión + un SELECT 1).
 *   3. Que el cliente Prisma está al día con el schema.
 *   4. Que las claves Stripe NO están en modo test cuando NEXT_PUBLIC_APP_URL
 *      apunta a un dominio real (heurística para evitar deploys con sk_test).
 *
 * No modifica nada. Sólo reporta.
 */
import 'dotenv/config';
import * as mariadb from 'mariadb';

const REQUIRED = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
];

const OPTIONAL = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'STRIPE_PUBLISHABLE_KEY'];

let exitCode = 0;
const log = (icon, msg) => console.log(`${icon}  ${msg}`);
const ok = (m) => log('✅', m);
const warn = (m) => { log('⚠️ ', m); };
const err = (m) => { log('❌', m); exitCode = 1; };

console.log('\n🔍 Verificando configuración de deploy...\n');

// ── 1. Variables de entorno ──────────────────────────────────────────────
console.log('─── Variables de entorno ───');
for (const v of REQUIRED) {
    const value = process.env[v];
    if (!value || !value.trim()) err(`Falta ${v}`);
    else ok(`${v} presente`);
}
for (const v of OPTIONAL) {
    if (!process.env[v]) warn(`${v} vacía (opcional, pero algunos flujos la usan)`);
}

// ── 2. Coherencia de URLs ────────────────────────────────────────────────
console.log('\n─── Coherencia ───');
if (process.env.NEXTAUTH_URL && process.env.NEXT_PUBLIC_APP_URL) {
    if (process.env.NEXTAUTH_URL.replace(/\/$/, '') !== process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')) {
        warn('NEXTAUTH_URL y NEXT_PUBLIC_APP_URL no coinciden — ambas deberían apuntar al mismo dominio');
    } else {
        ok('NEXTAUTH_URL y NEXT_PUBLIC_APP_URL coinciden');
    }
}

// ── 3. Stripe live vs test ──────────────────────────────────────────────
const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
const isProdDomain = appUrl && !/localhost|127\.0\.0\.1|\.local|\.test/.test(appUrl);
if (process.env.STRIPE_SECRET_KEY) {
    const isTest = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    if (isProdDomain && isTest) {
        err('STRIPE_SECRET_KEY está en modo TEST pero NEXT_PUBLIC_APP_URL parece de producción');
    } else if (isTest) {
        warn('STRIPE_SECRET_KEY en modo TEST (correcto para staging/dev)');
    } else {
        ok('STRIPE_SECRET_KEY en modo LIVE');
    }
}
if (process.env.STRIPE_WEBHOOK_SECRET) {
    if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
        err('STRIPE_WEBHOOK_SECRET no parece válido (debe empezar por whsec_)');
    } else {
        ok('STRIPE_WEBHOOK_SECRET con formato correcto');
    }
}

// ── 4. Conexión a BD ─────────────────────────────────────────────────────
console.log('\n─── Base de datos ───');
if (!process.env.DATABASE_URL) {
    err('Sin DATABASE_URL no se puede testear conexión');
} else {
    try {
        const url = process.env.DATABASE_URL.replace(/^mysql:\/\//, 'mariadb://');
        const conn = await mariadb.createConnection(url);
        const [{ now, version }] = await conn.query('SELECT NOW() AS now, VERSION() AS version');
        ok(`Conectado: MariaDB ${version} · servidor en ${now}`);

        // Comprobar tablas nuevas (Sprints 2-5 + continuo)
        const required = ['products', 'orders', 'users', 'webhook_events', 'subscribers', 'audit_logs', 'stock_movements'];
        const tables = await conn.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
        );
        const have = new Set(tables.map((t) => t.TABLE_NAME));
        const missing = required.filter((t) => !have.has(t));
        if (missing.length === 0) {
            ok('Todas las tablas requeridas presentes');
        } else {
            warn(`Tablas pendientes de migración: ${missing.join(', ')} → ejecutar 'npx prisma db push'`);
        }

        // Comprobar columnas nuevas más críticas
        const orderCols = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
        );
        const orderColNames = new Set(orderCols.map((c) => c.COLUMN_NAME));
        const newOrderCols = ['payment_intent_id', 'invoice_number', 'invoice_url', 'fulfillment_status'];
        const missingOrder = newOrderCols.filter((c) => !orderColNames.has(c));
        if (missingOrder.length === 0) {
            ok('Columnas nuevas de orders presentes');
        } else {
            warn(`Columnas nuevas en orders pendientes: ${missingOrder.join(', ')}`);
        }

        await conn.end();
    } catch (e) {
        err(`No se pudo conectar a la BD: ${e.message}`);
    }
}

// ── Resultado final ──────────────────────────────────────────────────────
console.log('');
if (exitCode === 0) {
    console.log('🟢 Configuración OK. Listo para deploy.');
} else {
    console.log('🔴 Hay problemas que resolver antes de deployar.');
}
process.exit(exitCode);
