/**
 * Master Verification & Execution Pipeline Runner
 * File: database/load/run-all.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
  dateStrings: true
};

async function executeSqlFile(connection, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
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

async function run() {
  console.log('Testing MySQL connection...');
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Connected to MySQL!');

    console.log('\n--- Step 1: Executing 01_schema.sql ---');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/01_schema.sql'));
    console.log('✓ 01_schema.sql completed.');

    // Switch connection to railway_db
    await connection.query('USE railway_db;');

    console.log('\n--- Step 2: Executing 02_functions.sql ---');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/02_functions.sql'));
    console.log('✓ 02_functions.sql completed.');

    console.log('\n--- Step 3: Executing 03_procedures.sql ---');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/03_procedures.sql'));
    console.log('✓ 03_procedures.sql completed.');

    console.log('\n--- Step 4: Executing 05_views.sql ---');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/05_views.sql'));
    console.log('✓ 05_views.sql completed.');

    console.log('\n--- Step 5: Loading Seed Data (load-mysql.js) ---');
    console.log('(Triggers are not created yet so batch loading is fast and unblocked)');
    execSync('node database/load/load-mysql.js', { stdio: 'inherit' });

    console.log('\n--- Step 6: Executing 04_triggers.sql ---');
    console.log('(Attaching triggers including seat overlap check & cancellation promotion)');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/04_triggers.sql'));
    console.log('✓ 04_triggers.sql completed.');

    console.log('\n--- Step 7: Executing 07_tests.sql ---');
    await executeSqlFile(connection, path.resolve(__dirname, '../mysql/07_tests.sql'));
    console.log('✓ 07_tests.sql procedures installed.');

    console.log('\n--- Step 8: Running Master Automated Test Suite ---');
    const [testOutputs] = await connection.query('CALL sp_run_all_tests();');
    if (Array.isArray(testOutputs)) {
      for (const resSet of testOutputs) {
        if (Array.isArray(resSet) && resSet.length > 0) {
          if (resSet[0].test_id !== undefined) {
            console.log('\n=== Master Automated Test Suite Results ===');
            console.table(resSet);
          } else {
            console.table(resSet);
          }
        }
      }
    }

    const keepTests = process.argv.includes('--with-tests');
    if (!keepTests) {
      console.log('\n--- Step 8b: Cleaning up Test Harness Objects ---');
      await connection.query(`
        DROP TABLE IF EXISTS test_results;
        DROP PROCEDURE IF EXISTS test_story_1;
        DROP PROCEDURE IF EXISTS test_story_2;
        DROP PROCEDURE IF EXISTS test_story_3;
        DROP PROCEDURE IF EXISTS test_story_4;
        DROP PROCEDURE IF EXISTS test_story_5;
        DROP PROCEDURE IF EXISTS test_waiting_list_full;
        DROP PROCEDURE IF EXISTS test_rac_open;
        DROP PROCEDURE IF EXISTS test_berth_preference_not_met;
        DROP PROCEDURE IF EXISTS test_monthly_limit_exceeded;
        DROP PROCEDURE IF EXISTS test_chart_prepared;
        DROP PROCEDURE IF EXISTS test_whole_pnr_cancel_two_seats;
        DROP PROCEDURE IF EXISTS test_cancel_wl_passenger;
        DROP PROCEDURE IF EXISTS test_whole_pnr_cancel_mixed_passengers;
        DROP PROCEDURE IF EXISTS test_cancel_after_chart;
        DROP PROCEDURE IF EXISTS test_tatkal_confirmed_cancel;
        DROP PROCEDURE IF EXISTS test_counter_ticket_cancel;
        DROP PROCEDURE IF EXISTS test_real_general_waiting_list_full;
        DROP PROCEDURE IF EXISTS test_real_general_rac_allocation;
        DROP PROCEDURE IF EXISTS test_real_inventory_sync_after_cancel_promotion;
        DROP PROCEDURE IF EXISTS sp_run_all_tests;
      `);
      console.log('✓ Test harness procedures and test_results table cleaned up.');
    }

    const [finalObjects] = await connection.query('SHOW FULL TABLES;');
    console.log(`\nFinal SHOW FULL TABLES count in railway_db: ${finalObjects.length} (37 base tables + 5 views = 42)`);

    console.log('\n--- Step 9: Running MongoDB Loader (load-mongo.js) ---');
    execSync('node database/load/load-mongo.js', { stdio: 'inherit' });

    console.log('\n✓ All steps completed successfully!');

  } catch (err) {
    console.error('[ERROR]:', err.message);
    if (err.sql) console.error('SQL:', err.sql.slice(0, 200));
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
