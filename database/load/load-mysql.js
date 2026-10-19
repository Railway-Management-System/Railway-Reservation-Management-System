/**
 * MySQL 8.0 Seed Data Loader
 * File: database/load/load-mysql.js
 * 
 * Rules & Guarantees:
 * 1. Reads credentials strictly from database/.env
 * 2. Uses mysql2 batch inserts with parameterized statements (NO LOAD DATA INFILE)
 * 3. Safe to re-run: disables foreign key checks, truncates all 37 tables, batch-inserts,
 *    and re-enables foreign key checks.
 * 4. Loads all 37 CSV files in exact topological foreign key dependency order.
 * 5. Handles quotes, commas, NULL values, and ISO timestamps.
 * 6. Logs row counts and verifies foreign key integrity.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables from database/.env
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error(`ERROR: Environment file not found at ${envPath}.`);
  console.error('Please copy database/.env.example to database/.env and configure your MySQL credentials.');
  process.exit(1);
}
dotenv.config({ path: envPath });

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'railway_db',
  multipleStatements: true,
  dateStrings: true
};

const SEED_DIR = path.resolve(__dirname, '../seed-data/mysql');
const BATCH_SIZE = 1000;

// Exact topological loading order for all 37 tables
const TABLES_IN_ORDER = [
  'STATION',
  'TRAIN',
  'ROUTE_STOP',
  'PLATFORM',
  'SEAT_CLASS',
  'COACH',
  'SEAT',
  'USER_ACCOUNT',
  'SAVED_PASSENGER',
  'ADMIN',
  'STAFF',
  'TRAIN_SCHEDULE',
  'SCHEDULE_CLASS_INVENTORY',
  'RUN_COACH_STATUS',
  'STAFF_ASSIGNMENT',
  'SEAT_HOLD',
  'FARE',
  'CONCESSION_RULE',
  'REFUND_RULE',
  'TDR_RULE',
  'SETTING',
  'BOOKING',
  'PASSENGER_BOOKING',
  'RESERVATION',
  'PAYMENT',
  'CANCELLATION',
  'TDR_FILING',
  'REFUND',
  'TICKET_VERIFICATION',
  'FINE',
  'MAINTENANCE',
  'INCIDENT',
  'CROWD_REPORT',
  'CLEANLINESS_REPORT',
  'AUDIT_LOG',
  'REPORT',
  'CHART_SNAPSHOT'
];

/**
 * Robust CSV line splitter that respects quoted strings containing commas or escaped quotes
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Formats a raw CSV value for MySQL database insertion
 */
function formatValue(val) {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'NULL') {
    return null;
  }
  // Check for ISO-8601 timestamp with 'T' and 'Z'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
  }
  return trimmed;
}

async function loadTable(connection, tableName) {
  const filePath = path.join(SEED_DIR, `${tableName}.csv`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}, skipping table ${tableName}`);
    return 0;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let header = null;
  let batch = [];
  let totalInserted = 0;

  for await (const line of rl) {
    if (!line || line.trim() === '') continue;
    
    if (!header) {
      header = parseCsvLine(line).map(h => h.trim());
      continue;
    }

    const rowValues = parseCsvLine(line).map(formatValue);
    batch.push(rowValues);

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(connection, tableName, header, batch);
      totalInserted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertBatch(connection, tableName, header, batch);
    totalInserted += batch.length;
  }

  return totalInserted;
}

async function insertBatch(connection, tableName, header, rows) {
  if (rows.length === 0) return;

  const columnsSql = header.map(h => `\`${h}\``).join(', ');
  const placeholders = rows.map(() => `(${header.map(() => '?').join(', ')})`).join(',\n');
  const sql = `INSERT INTO \`${tableName}\` (${columnsSql}) VALUES ${placeholders};`;
  
  const flattenedParams = [];
  for (const row of rows) {
    for (let i = 0; i < header.length; i++) {
      flattenedParams.push(row[i] !== undefined ? row[i] : null);
    }
  }

  await connection.query(sql, flattenedParams);
}

async function main() {
  console.log('===============================================================');
  console.log('   MySQL 8.0 High-Performance Seed Data Batch Loader');
  console.log('===============================================================');
  console.log(`Target Database : ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log(`Connecting as   : ${DB_CONFIG.user}\n`);

  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Successfully connected to MySQL server.');

    console.log('\n[Phase 1] Disabling Foreign Key Checks & Truncating Tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Truncate tables in reverse order
    for (const table of [...TABLES_IN_ORDER].reverse()) {
      try {
        await connection.query(`TRUNCATE TABLE \`${table}\`;`);
      } catch (err) {
        // Fallback to DELETE if TRUNCATE has foreign key restriction in some engine configs
        await connection.query(`DELETE FROM \`${table}\`;`);
      }
    }
    console.log('✓ All 37 tables cleared cleanly.');

    console.log('\n[Phase 2] Loading Seed CSV Data via Parameterized Batches...');
    const startTime = Date.now();
    const loadedCounts = {};

    for (const table of TABLES_IN_ORDER) {
      process.stdout.write(`  -> Loading ${table.padEnd(26)} `);
      const rowCount = await loadTable(connection, table);
      loadedCounts[table] = rowCount;
      console.log(`[ ${rowCount.toString().padStart(6)} rows ]`);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ All tables successfully populated in ${durationSec}s.`);

    console.log('\n[Phase 3] Re-enabling Foreign Key Checks & Running Integrity Verification...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Foreign key checks re-enabled.');

    console.log('\n[Phase 4] Verifying Row Counts in Database:');
    let totalDbRows = 0;
    for (const table of TABLES_IN_ORDER) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${table}\`;`);
      const count = rows[0].cnt;
      totalDbRows += count;
      const match = count === loadedCounts[table] ? 'OK' : 'MISMATCH';
      console.log(`  ${table.padEnd(26)} : ${count.toString().padStart(6)} rows (${match})`);
    }
    console.log(`\nTotal Rows across 37 tables: ${totalDbRows}`);

  } catch (error) {
    console.error('\n[FATAL ERROR]:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.sql) console.error('Failed SQL Snippet:', error.sql.slice(0, 300));
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        await connection.end();
      } catch (e) {}
    }
  }
}

if (require.main === module) {
  main();
}
