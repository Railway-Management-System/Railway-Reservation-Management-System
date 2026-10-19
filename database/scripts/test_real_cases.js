const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function executeSqlFile(connection, filePath) {
  const content = require('fs').readFileSync(filePath, 'utf8');
  const cleanedStatements = [];
  const lines = content.split('\n');
  let currentDelimiter = ';';
  let buffer = '';

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
      currentDelimiter = trimmed.substring(10).trim();
      continue;
    }

    buffer += line + '\n';
    if (trimmed.endsWith(currentDelimiter)) {
      let stmt = buffer.trim();
      if (stmt.endsWith(currentDelimiter)) {
        stmt = stmt.slice(0, -currentDelimiter.length).trim();
      }
      if (stmt.length > 0) {
        cleanedStatements.push(stmt);
      }
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) {
    cleanedStatements.push(buffer.trim());
  }

  for (const stmt of cleanedStatements) {
    if (stmt.length > 0) {
      await connection.query(stmt);
    }
  }
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    dateStrings: true
  });

  console.log('=== TEST REAL DATA SCENARIOS ===\n');

  // 1. Reload 03_procedures.sql to ensure MySQL has latest procedure definitions
  await executeSqlFile(conn, 'database/mysql/03_procedures.sql');
  console.log('Reloaded 03_procedures.sql');

  // Test (a): Train 123 on 2026-10-18 (Schedule 1127, Class 3) GENERAL booking
  console.log('\n--- Test (a): Train 123 on 2026-10-18 (Schedule 1127) GENERAL booking ---');
  const [inv123Before] = await conn.query('SELECT total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = 1127 AND class_id = 3');
  console.log('Real inventory before test (Schedule 1127, Class 3):', inv123Before[0]);

  await conn.beginTransaction();
  const [resA] = await conn.query(`
    CALL sp_create_booking(
      50001, 1127, 3, 1109, 1118, 'GENERAL', 0, 0,
      JSON_ARRAY(JSON_OBJECT('saved_passenger_id', 7, 'name', 'Test WL Full User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')),
      'ONLINE', NULL, 0,
      @out_pnr, @out_stat, @out_fare, @out_err
    );
    SELECT @out_pnr AS pnr, @out_stat AS status, @out_fare AS fare, @out_err AS err;
  `);
  console.log('Test (a) Result:', resA[resA.length - 1]);
  await conn.rollback();

  // Test (b): Train 131 on 2026-10-18 (Schedule 1174, Class 3) GENERAL booking
  console.log('\n--- Test (b): Train 131 on 2026-10-18 (Schedule 1174) GENERAL booking ---');
  const [inv131Before] = await conn.query('SELECT total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = 1174 AND class_id = 3');
  console.log('Real inventory before test (Schedule 1174, Class 3):', inv131Before[0]);

  await conn.beginTransaction();
  const [resB] = await conn.query(`
    CALL sp_create_booking(
      50001, 1174, 3, 1001, 1005, 'GENERAL', 0, 0,
      JSON_ARRAY(JSON_OBJECT('saved_passenger_id', 7, 'name', 'Test RAC User', 'age', 30, 'gender', 'MALE', 'concession_type', 'NONE', 'berth_preference', 'NO_BERTH')),
      'ONLINE', NULL, 0,
      @out_pnr, @out_stat, @out_fare, @out_err
    );
    SELECT @out_pnr AS pnr, @out_stat AS status, @out_fare AS fare, @out_err AS err;
  `);
  console.log('Test (b) Result:', resB[resB.length - 1]);
  if (resB[resB.length - 1][0].pnr) {
    const [resDetails] = await conn.query('SELECT * FROM RESERVATION WHERE pnr = ?', [resB[resB.length - 1][0].pnr]);
    console.log('Reservation details:', resDetails[0]);
  }
  await conn.rollback();

  // Test 1(d): Inventory sync after cancel with promotion
  console.log('\n--- Test 1(d): Cancel with promotion on Schedule 1127, Class 3 ---');
  await conn.beginTransaction();
  // Find a CONFIRMED booking on 1127 class 3
  const [confSample] = await conn.query(`
    SELECT b.pnr, pb.passenger_no, r.seat_id
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    JOIN PASSENGER_BOOKING pb ON r.pnr = pb.pnr AND r.passenger_no = pb.passenger_no
    WHERE r.schedule_id = 1127 AND b.class_id = 3 AND r.status = 'CONFIRMED'
    LIMIT 1
  `);
  console.log('Sample Confirmed to Cancel:', confSample[0]);

  // Set as_of_time before chart time (departure is 2026-10-18 17:40:00)
  await conn.query("SET @as_of_time = '2026-10-18 08:00:00'");
  await conn.query("CALL sp_cancel_passenger_ticket(?, ?, 'TEST_SYNC', 0, @chg, @ref, @stat)", [confSample[0].pnr, confSample[0].passenger_no]);
  
  const [invAfter] = await conn.query('SELECT total_seats, available_seats, rac_count, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = 1127 AND class_id = 3');
  const [resCountsAfter] = await conn.query(`
    SELECT 
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS conf,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    WHERE r.schedule_id = 1127 AND b.class_id = 3
  `);
  console.log('Inventory after cancellation + promotion:', invAfter[0]);
  console.log('Actual reservations after cancellation + promotion:', resCountsAfter[0]);
  console.log('Expected available:', invAfter[0].total_seats - resCountsAfter[0].conf, 'Actual available:', invAfter[0].available_seats);
  console.log('Expected RAC:', resCountsAfter[0].rac, 'Actual RAC:', invAfter[0].rac_count);
  console.log('Expected WL:', resCountsAfter[0].wl, 'Actual WL:', invAfter[0].wl_count);
  await conn.rollback();

  await conn.end();
})();
