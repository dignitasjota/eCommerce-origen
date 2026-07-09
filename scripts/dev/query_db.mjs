import 'dotenv/config';
import * as mariadb from 'mariadb';

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

async function main() {
  const pool = mariadb.createPool(dbConfig);
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
