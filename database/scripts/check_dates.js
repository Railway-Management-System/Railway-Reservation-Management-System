const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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

  console.log('=== DATE COMPARISON: MySQL (with dateStrings: true) vs Raw CSV ===\n');

  // 1. TRAIN_SCHEDULE.journey_date
  console.log('--- 1. TRAIN_SCHEDULE (First 5 Rows) ---');
  const [schedRows] = await conn.query('SELECT schedule_id, train_id, journey_date, departure_time FROM TRAIN_SCHEDULE ORDER BY schedule_id LIMIT 5');
  const schedCsvLines = fs.readFileSync(path.join(__dirname, '../seed-data/mysql/TRAIN_SCHEDULE.csv'), 'utf8')
    .trim().split('\n').slice(1, 6);

  console.table(schedRows.map((row, idx) => ({
    schedule_id: row.schedule_id,
    train_id: row.train_id,
    'MySQL journey_date': row.journey_date,
    'CSV Line': schedCsvLines[idx].trim(),
    'Matches Exactly': schedCsvLines[idx].includes(row.journey_date) ? 'YES' : 'NO'
  })));

  // 2. BOOKING.created_at
  console.log('\n--- 2. BOOKING (First 5 Rows) ---');
  const [bookingRows] = await conn.query('SELECT pnr, schedule_id, total_fare, status, created_at FROM BOOKING ORDER BY pnr LIMIT 5');
  const bookingCsvLines = fs.readFileSync(path.join(__dirname, '../seed-data/mysql/BOOKING.csv'), 'utf8')
    .trim().split('\n').slice(1, 6);

  console.table(bookingRows.map((row, idx) => ({
    pnr: row.pnr,
    'MySQL created_at': row.created_at,
    'CSV Line': bookingCsvLines[idx].trim(),
    'Matches Exactly': bookingCsvLines[idx].includes(row.created_at) ? 'YES' : 'NO'
  })));

  await conn.end();
})();
