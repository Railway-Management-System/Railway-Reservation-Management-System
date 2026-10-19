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

  console.log('=== DEBUGGING CANCELLATION & PROMOTION ON SCHEDULE 1127, CLASS 3 ===\n');

  // 1. Check inventory before
  const [invBefore] = await conn.query('SELECT total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = 1127 AND class_id = 3');
  console.log('Inventory before:', invBefore[0]);

  // 2. Check reservation counts before
  const [resBefore] = await conn.query(`
    SELECT 
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS conf,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3
  `);
  console.log('Reservation counts before:', resBefore[0]);

  // 3. Pick a CONFIRMED passenger
  const [pass] = await conn.query(`
    SELECT r.res_id, r.pnr, r.passenger_no, b.quota, b.requested_quota, r.status, r.seat_id
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3 AND r.status = 'CONFIRMED'
    LIMIT 1
  `);
  console.log('Target passenger to cancel:', pass[0]);

  // 4. Start transaction
  await conn.beginTransaction();

  // Set as of time: train departs at 2026-10-18 12:45:00. Set 2026-10-18 02:00:00 (10h45m before departure, > 8h)
  await conn.query("SET @as_of_time = '2026-10-18 02:00:00'");

  // Call cancellation
  await conn.query("CALL sp_cancel_passenger_ticket(?, ?, 'TEST_CANCEL', 0, @out_chg, @out_ref, @out_stat)", [pass[0].pnr, pass[0].passenger_no]);
  const [cancelRes] = await conn.query('SELECT @out_chg AS charge, @out_ref AS refund, @out_stat AS status');
  console.log('Cancellation output:', cancelRes[0]);

  // Check CANCELLATION row
  const [cancelRow] = await conn.query('SELECT * FROM CANCELLATION WHERE pnr = ? AND passenger_no = ?', [pass[0].pnr, pass[0].passenger_no]);
  console.log('CANCELLATION row:', cancelRow);

  // Check reservation of the cancelled passenger
  const [cancelledPassRes] = await conn.query('SELECT * FROM RESERVATION WHERE pnr = ? AND passenger_no = ?', [pass[0].pnr, pass[0].passenger_no]);
  console.log('Reservation of cancelled passenger:', cancelledPassRes[0]);

  // Check if any RAC was promoted
  const [promotedRac] = await conn.query(`
    SELECT r.res_id, r.pnr, r.passenger_no, r.status, r.seat_id, r.queue_position
    FROM RESERVATION r
    WHERE r.seat_id = ?
  `, [pass[0].seat_id]);
  console.log('Passenger now in seat', pass[0].seat_id, ':', promotedRac);

  // Check inventory after
  const [invAfter] = await conn.query('SELECT total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = 1127 AND class_id = 3');
  console.log('Inventory after:', invAfter[0]);

  // Check reservation counts after
  const [resAfter] = await conn.query(`
    SELECT 
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS conf,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3
  `);
  console.log('Reservation counts after:', resAfter[0]);

  await conn.rollback();
  console.log('\nRolled back cleanly.');
  await conn.end();
})();
