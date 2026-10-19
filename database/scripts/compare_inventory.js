const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'railway_db',
    dateStrings: true
  });

  // Query actual reservation counts per schedule_id, class_id
  const [resRows] = await conn.query(`
    SELECT 
      r.schedule_id,
      b.class_id,
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS confirmed_boarded_count,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac_count,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl_count
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    GROUP BY r.schedule_id, b.class_id
  `);

  const resMap = {};
  for (const row of resRows) {
    const key = `${row.schedule_id}_${row.class_id}`;
    resMap[key] = {
      confirmed_boarded: parseInt(row.confirmed_boarded_count, 10),
      rac: parseInt(row.rac_count, 10),
      wl: parseInt(row.wl_count, 10)
    };
  }

  // Read all rows of SCHEDULE_CLASS_INVENTORY
  const [invRows] = await conn.query(`
    SELECT 
      inventory_id,
      schedule_id,
      class_id,
      total_seats,
      available_seats,
      rac_capacity,
      rac_count,
      wl_capacity,
      wl_count
    FROM SCHEDULE_CLASS_INVENTORY
    ORDER BY schedule_id, class_id
  `);

  console.log(`Total SCHEDULE_CLASS_INVENTORY rows: ${invRows.length}`);

  const mismatches = [];

  for (const inv of invRows) {
    const key = `${inv.schedule_id}_${inv.class_id}`;
    const real = resMap[key] || { confirmed_boarded: 0, rac: 0, wl: 0 };
    const expected_available = inv.total_seats - real.confirmed_boarded;
    const expected_rac = real.rac;
    const expected_wl = real.wl;

    const mismatch = (
      inv.available_seats !== expected_available ||
      inv.rac_count !== expected_rac ||
      inv.wl_count !== expected_wl
    );

    if (mismatch) {
      mismatches.push({
        inventory_id: inv.inventory_id,
        schedule_id: inv.schedule_id,
        class_id: inv.class_id,
        total: inv.total_seats,
        inv_avail: inv.available_seats,
        exp_avail: expected_available,
        inv_rac: inv.rac_count,
        exp_rac: expected_rac,
        inv_wl: inv.wl_count,
        exp_wl: expected_wl
      });
    }
  }

  console.log(`Mismatching rows: ${mismatches.length} out of ${invRows.length}`);
  console.log('\n--- 10 Examples of Mismatching Rows ---');
  console.table(mismatches.slice(0, 10));

  await conn.end();
})();
