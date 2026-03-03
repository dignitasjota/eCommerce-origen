const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const connectionUri = process.env.DATABASE_URL;
        if (!connectionUri) {
            console.log("No DATABASE_URL in .env");
            return;
        }
        const c = await mysql.createConnection(connectionUri);

        const [settings] = await c.query('SELECT value FROM site_settings WHERE `key`="pages_prefix"');
        console.log("pages_prefix:", settings);

        const [pages] = await c.query('SELECT id, slug FROM pages');
        console.log("pages:", pages);

        const [translations] = await c.query('SELECT page_id, locale, title FROM page_translations');
        console.log("translations:", translations);

        c.end();
    } catch (e) {
        console.error(e);
    }
}
check();
