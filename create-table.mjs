import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: '88.99.246.98',
        user: 'db_ecomm_user',
        password: 'eCommPass!653',
        database: 'db_ecommerce',
    });

    try {
        await connection.execute('DROP TABLE IF EXISTS `related_products`;');
        console.log("Table dropped if existed.");

        const createTableQuery = `
      CREATE TABLE \`related_products\` (
        \`id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`related_product_id\` varchar(36) NOT NULL,
        \`relation_type\` enum('CROSS_SELL','UP_SELL') NOT NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT current_timestamp(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_product_related\` (\`product_id\`,\`related_product_id\`),
        KEY \`idx_related_product\` (\`product_id\`),
        KEY \`idx_related_from_product\` (\`related_product_id\`),
        CONSTRAINT \`related_products_ibfk_1\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`related_products_ibfk_2\` FOREIGN KEY (\`related_product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
    `;

        await connection.execute(createTableQuery);
        console.log("Table created successfully with utf8mb3 charset!");
    } catch (e) {
        console.error("Error creating table:", e);
    }

    await connection.end();
}

main().catch(console.error);
