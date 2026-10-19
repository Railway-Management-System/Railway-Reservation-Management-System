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

  console.log('=== vw_available_seats_per_run (Train 123 and Train 131 on 2026-10-18) ===\n');
  const [availRows] = await conn.query(`
    SELECT 
      schedule_id,
      train_id,
      train_number,
      train_name,
      journey_date,
      class_code,
      total_seats,
      available_seats,
      rac_capacity,
      rac_count,
      wl_capacity,
      wl_count,
      seat_booked_pct
    FROM vw_available_seats_per_run
    WHERE train_id IN (123, 131) AND journey_date = '2026-10-18'
    ORDER BY train_id, class_code
  `);
  console.table(availRows);

  console.log('\n=== vw_run_occupancy (Train 123 and Train 131 on 2026-10-18) ===\n');
  const [occRows] = await conn.query(`
    SELECT 
      schedule_id,
      train_id,
      train_number,
      train_name,
      journey_date,
      total_train_capacity,
      total_seats_booked,
      total_seats_available,
      total_rac_passengers,
      total_wl_passengers,
      occupancy_pct
    FROM vw_run_occupancy
    WHERE train_id IN (123, 131) AND journey_date = '2026-10-18'
    ORDER BY train_id
  `);
  console.table(occRows);

  await conn.end();
})();
