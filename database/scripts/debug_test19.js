const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    dateStrings: true
  });

  const [rows] = await conn.query(`
    SELECT r.pnr, r.passenger_no, b.quota, b.requested_quota, r.status, r.seat_id
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3 AND r.status = 'CONFIRMED'
    LIMIT 5
  `);
  console.log('Top 5 Confirmed passengers:', rows);

  // Check quota distribution
  const [quotas] = await conn.query(`
    SELECT b.quota, COUNT(*) as cnt
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3 AND r.status = 'CONFIRMED'
    GROUP BY b.quota
  `);
  console.log('Confirmed by quota on 1127 class 3:', quotas);

  await conn.end();
})();
