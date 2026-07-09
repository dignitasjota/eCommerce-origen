require('dotenv/config');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el entorno (.env). Aborta.');
    process.exit(1);
}

// Deriva los parámetros de conexión desde DATABASE_URL en lugar de
// hardcodear credenciales en el repo.
const dbUrl = new URL(process.env.DATABASE_URL);
const dbConfig = {
    host: dbUrl.hostname,
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
};

async function seed() {
    const c = await mysql.createConnection(dbConfig);

    const pageId = uuidv4();
    const transId = uuidv4();

    await c.query('INSERT IGNORE INTO pages (id, slug) VALUES (?, ?)', [pageId, 'packs-ahorro']);
    await c.query('INSERT IGNORE INTO page_translations (id, page_id, locale, title, content) VALUES (?, ?, ?, ?, ?)', [transId, pageId, 'es', 'Packs Ahorro', '<h2>Nuestros Packs</h2>\n<p>Estos son los mejores packs.</p>\n{{category_id:audio}}']);

    console.log("Created packs-ahorro via direct SQL");
    c.end();
}
seed().catch(console.error);
