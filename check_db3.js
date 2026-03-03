const mysql = require('mysql2/promise');
async function f() {
    const c = await mysql.createConnection({ host: '88.99.246.98', user: 'db_ecomm_user', password: 'eCommPass!653', database: 'db_ecommerce' });
    const [settings] = await c.query('SELECT value FROM site_settings WHERE \`key\`="pages_prefix"');
    console.log("pages_prefix:", settings);
    const [pages] = await c.query('SELECT id, slug FROM pages');
    console.log("pages:", pages);
    const [translations] = await c.query('SELECT page_id, locale, title FROM page_translations');
    console.log("translations:", translations);
    c.end();
}
f();
