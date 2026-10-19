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

  // Train 131 schedule on 2026-10-18 is 1174
  console.log('=== Train 131 on 2026-10-18 (Schedule 1174) ===\n');

  // Coaches and total seats per class
  const [coaches] = await conn.query(`
    SELECT c.class_id, sc.class_code, COUNT(c.coach_id) as coach_count, SUM(c.total_seats) as total_seats
    FROM COACH c
    JOIN SEAT_CLASS sc ON c.class_id = sc.class_id
    WHERE c.train_id = 131
    GROUP BY c.class_id, sc.class_code
    ORDER BY c.class_id
  `);
  console.log('Coaches & Seats:');
  console.table(coaches);

  // Inventory in DB
  const [inv] = await conn.query(`
    SELECT class_id, total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count
    FROM SCHEDULE_CLASS_INVENTORY
    WHERE schedule_id = 1174
    ORDER BY class_id
  `);
  console.log('\nSCHEDULE_CLASS_INVENTORY:');
  console.table(inv);

  // Real Bookings and Reservations per class and quota
  const [resBreakdown] = await conn.query(`
    SELECT 
      b.class_id,
      sc.class_code,
      b.quota,
      r.status,
      COUNT(*) as count
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    JOIN SEAT_CLASS sc ON b.class_id = sc.class_id
    WHERE r.schedule_id = 1174
    GROUP BY b.class_id, sc.class_code, b.quota, r.status
    ORDER BY b.class_id, b.quota, r.status
  `);
  console.log('\nReservations Breakdown:');
  console.table(resBreakdown);

  // Train 123 schedule on 2026-10-18 is 1127
  console.log('\n=== Train 123 on 2026-10-18 (Schedule 1127) ===\n');
  const [res123] = await conn.query(`
    SELECT 
      b.class_id,
      sc.class_code,
      b.quota,
      r.status,
      COUNT(*) as count
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    JOIN SEAT_CLASS sc ON b.class_id = sc.class_id
    WHERE r.schedule_id = 1127
    GROUP BY b.class_id, sc.class_code, b.quota, r.status
    ORDER BY b.class_id, b.quota, r.status
  `);
  console.log('Train 123 breakdown:');
  console.table(res123);

  // Settings table check
  const [settings] = await conn.query(`SELECT * FROM SETTING`);
  console.log('\nSETTING table rows:');
  console.table(settings);

  await conn.end();
})();
