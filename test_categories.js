const mysql = require('mysql2/promise');
async function f() {
  const c = await mysql.createConnection({ host: '88.99.246.98', user: 'db_ecomm_user', password: 'eCommPass!653', database: 'db_ecommerce' });
  const [cols] = await c.query('SELECT slug FROM categories');
  console.log("cats::", cols);
  const [pages] = await c.query('SELECT slug FROM pages');
  console.log("Pages::", pages);
  c.end();
}
f();
