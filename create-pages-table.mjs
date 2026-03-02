import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: '88.99.246.98',
        user: 'db_ecomm_user',
        password: 'eCommPass!653',
        database: 'db_ecommerce',
    });

    try {
        const createPagesQuery = `
      CREATE TABLE IF NOT EXISTS \`pages\` (
        \`id\` varchar(36) NOT NULL,
        \`slug\` varchar(255) NOT NULL,
        \`created_at\` datetime(3) NOT NULL DEFAULT current_timestamp(3),
        \`updated_at\` datetime(3) NOT NULL DEFAULT current_timestamp(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`page_slug\` (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
    `;

        await connection.execute(createPagesQuery);
        console.log("pages table created.");

        const createTranslationsQuery = `
      CREATE TABLE IF NOT EXISTS \`page_translations\` (
        \`id\` varchar(36) NOT NULL,
        \`page_id\` varchar(36) NOT NULL,
        \`locale\` varchar(5) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`content\` longtext NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_page_locale\` (\`page_id\`,\`locale\`),
        KEY \`page_translations_ibfk_1\` (\`page_id\`),
        CONSTRAINT \`page_translations_ibfk_1\` FOREIGN KEY (\`page_id\`) REFERENCES \`pages\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
    `;

        await connection.execute(createTranslationsQuery);
        console.log("page_translations table created.");

    } catch (e) {
        console.error("Error creating tables:", e);
    }

    await connection.end();
}

main().catch(console.error);
