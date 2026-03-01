import * as mariadb from 'mariadb';

async function main() {
  const pool = mariadb.createPool({ host: '88.99.246.98', user: 'db_ecomm_user', password: 'eCommPass!653', database: 'db_ecommerce' });
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT slug FROM products LIMIT 1');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) conn.release();
    pool.end();
  }
}
main();
