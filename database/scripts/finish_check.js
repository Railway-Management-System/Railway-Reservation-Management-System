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

  console.log('=== 1. SHOW TRIGGERS ===');
  const [triggers] = await conn.query('SHOW TRIGGERS');
  console.table(triggers.map(t => ({
    Trigger: t.Trigger,
    Event: t.Event,
    Table: t.Table,
    Timing: t.Timing
  })));

  console.log('\n=== 2. SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'railway_db\' ===');
  const [tblCount] = await conn.query("SELECT COUNT(*) AS total_objects FROM information_schema.tables WHERE table_schema = 'railway_db'");
  console.log('Total objects count:', tblCount[0].total_objects);

  const [objBreakdown] = await conn.query(`
    SELECT table_type, COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'railway_db' 
    GROUP BY table_type
  `);
  console.table(objBreakdown);

  console.log('\n=== 3. AUDIT_LOG COUNT ===');
  const [auditRows] = await conn.query('SELECT COUNT(*) AS audit_count FROM AUDIT_LOG');
  console.log('AUDIT_LOG count:', auditRows[0].audit_count);

  console.log('\n=== 4. SELECT NOW() ===');
  const [nowRows] = await conn.query('SELECT NOW() AS current_db_time');
  console.log('Current DB Time:', nowRows[0].current_db_time);

  await conn.end();
})();
