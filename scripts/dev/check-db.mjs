import 'dotenv/config';
import mysql from 'mysql2/promise';

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
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute('SHOW CREATE TABLE products');
    console.log(rows[0]['Create Table']);

    await connection.end();
}

main().catch(console.error);
