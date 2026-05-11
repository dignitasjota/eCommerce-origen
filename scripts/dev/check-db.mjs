import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: '88.99.246.98',
        user: 'db_ecomm_user',
        password: 'eCommPass!653',
        database: 'db_ecommerce',
    });

    const [rows] = await connection.execute('SHOW CREATE TABLE products');
    console.log(rows[0]['Create Table']);

    await connection.end();
}

main().catch(console.error);
