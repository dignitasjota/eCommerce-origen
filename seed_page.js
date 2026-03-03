const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const c = await mysql.createConnection({ host: '88.99.246.98', user: 'db_ecomm_user', password: 'eCommPass!653', database: 'db_ecommerce' });

    const pageId = uuidv4();
    const transId = uuidv4();

    await c.query('INSERT IGNORE INTO pages (id, slug) VALUES (?, ?)', [pageId, 'packs-ahorro']);
    await c.query('INSERT IGNORE INTO page_translations (id, page_id, locale, title, content) VALUES (?, ?, ?, ?, ?)', [transId, pageId, 'es', 'Packs Ahorro', '<h2>Nuestros Packs</h2>\n<p>Estos son los mejores packs.</p>\n{{category_id:audio}}']);

    console.log("Created packs-ahorro via direct SQL");
    c.end();
}
seed().catch(console.error);
