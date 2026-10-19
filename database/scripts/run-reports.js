const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve('database/.env') });

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'railway_db',
        multipleStatements: true,
        dateStrings: true
    });

    const sql = fs.readFileSync('database/mysql/06_reports.sql', 'utf8');
    const queries = sql
        .split(/;\s*[\r\n]+/)
        .map(q => q.trim())
        .filter(q => q.toUpperCase().startsWith('SELECT'));

    for (let i = 0; i < queries.length; i++) {
        console.log('\n=======================================================');
        console.log('REPORT ' + (i + 1) + ' (First 10 rows):');
        console.log('=======================================================');
        const [rows] = await conn.query(queries[i]);
        console.table(rows.slice(0, 10));
    }

    const views = [
        'vw_available_seats_per_run',
        'vw_booking_summary',
        'vw_run_occupancy',
        'vw_tdr_refund_summary',
        'vw_train_master_schedule'
    ];

    for (const v of views) {
        console.log('\n=======================================================');
        console.log('VIEW ' + v + ' (First 5 rows):');
        console.log('=======================================================');
        const [rows] = await conn.query('SELECT * FROM ' + v + ' LIMIT 5');
        console.table(rows);
    }

    console.log('\n=======================================================');
    console.log('FINAL COUNTS & TIME:');
    console.log('=======================================================');
    const [[{ now_val }]] = await conn.query('SELECT NOW() as now_val');
    const [[{ audit_cnt }]] = await conn.query('SELECT COUNT(*) as audit_cnt FROM audit_log');
    const [tables] = await conn.query("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='railway_db' ORDER BY table_type, table_name");
    
    console.log('SELECT NOW():', now_val);
    console.log('SELECT COUNT(*) FROM audit_log:', audit_cnt);
    console.log('SHOW FULL TABLES count:', tables.length);

    await conn.end();
})();
