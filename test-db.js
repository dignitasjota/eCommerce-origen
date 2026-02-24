require('dotenv').config({ path: '.env' });
const mariadb = require('mariadb');
const url = process.env.DATABASE_URL.replace(/^mysql:\/\//, 'mariadb://');
console.log("Testing URL:", url.replace(/:[^:@]+@/, ':***@'));
const pool = mariadb.createPool(url);
pool.getConnection()
  .then(conn => {
    console.log("Connected successfully!");
    conn.release();
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection failed:", err);
    process.exit(1);
  });
