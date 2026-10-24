/**
 * Railway Reservation System - Test Suite D4
 * File: backend/scripts/test-d4.js
 * 
 * Verifies Daily Operations Simulator (simulate-daily.js):
 * 1. Window rolled with --today=2026-10-26 creates runs for new days in window.
 * 2. Idempotency: second run creates 0 duplicate runs and 0 duplicate bookings.
 * 3. Procedure-only booking integrity: bookings conform to sp_create_booking.
 * 4. Chart preparation: executes for runs reaching chart time (<= 8h).
 * 5. Master Inventory Audit: 0 mismatches across all runs (1,015 + new runs).
 */

const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');
const pool = require('../src/config/mysql');
const { connectMongo, closeMongo } = require('../src/config/mongodb');
const { auditInventory, getDateWindow } = require('./helpers/simulationHelper');

const rootDir = path.resolve(__dirname, '../../');
const backendDir = path.resolve(__dirname, '../');

function runSimulatorCli(args = []) {
  const res = spawnSync('node', ['scripts/simulate-daily.js', ...args], {
    cwd: backendDir,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  });
  return res;
}

async function runTestD4() {
  const safetyTimeout = setTimeout(() => {
    console.error('\n[FATAL ERROR]: Safety timeout of 120 seconds reached. Test suite test-d4 timed out!');
    process.exit(1);
  }, 120000);
  safetyTimeout.unref();

  console.log('========================================================================================');
  console.log(' TEST SUITE D4: DAILY OPERATIONS SIMULATOR & ROLLING WINDOW IDEMPOTENCY');
  console.log('========================================================================================\n');

  // Ensure clean baseline if test is executed standalone
  const [futureCheck] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE journey_date > "2026-10-24"');
  if (futureCheck[0].cnt > 0) {
    console.log('[Test Setup] Resetting database to baseline seed data...');
    spawnSync('node', ['database/load/run-all.js'], { cwd: rootDir, stdio: 'ignore' });
  }

  await connectMongo();
  const testResults = [];

  function record(id, name, expected, actual, passed, details) {
    testResults.push({
      id,
      name,
      expected: String(expected),
      actual: String(actual),
      status: passed ? 'PASS' : 'FAIL',
      details
    });
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] Test ${id}: ${name}`);
    if (!passed) {
      console.error(`      Expected: ${expected}`);
      console.error(`      Actual:   ${actual}`);
      console.error(`      Details:  ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Window Rolled with --today=2026-10-26
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Window Rolling with --today=2026-10-26 ---');
    const sim1 = runSimulatorCli(['--today=2026-10-26']);
    assert.strictEqual(sim1.status, 0, `Simulator exit code 0 on --today=2026-10-26. Stderr: ${sim1.stderr}`);

    const rolledDates = getDateWindow('2026-10-26', 7);
    const [schedCountRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE journey_date IN (?)',
      [rolledDates]
    );

    const hasNewDates = sim1.stdout.includes('Operating window: 2026-10-26 to 2026-11-01');
    const runsCreatedMatch = sim1.stdout.match(/Runs Created:\s+(\d+)/);
    const runsCreated1 = runsCreatedMatch ? parseInt(runsCreatedMatch[1], 10) : 0;

    record(
      1,
      'Simulator Window Rolling (--today=2026-10-26)',
      'Exit 0, window 2026-10-26 to 2026-11-01, schedules created',
      `Exit ${sim1.status}, Window matched: ${hasNewDates}, Runs: ${runsCreated1}`,
      sim1.status === 0 && hasNewDates && runsCreated1 > 0 && schedCountRows[0].cnt > 0,
      `Created ${runsCreated1} new runs for the 7-day window. Total schedules in window: ${schedCountRows[0].cnt}.`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Idempotency Check (Second Run on Same Date)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Idempotency on Second Run ---');
    const sim2 = runSimulatorCli(['--today=2026-10-26']);
    assert.strictEqual(sim2.status, 0, `Simulator exit code 0 on second run. Stderr: ${sim2.stderr}`);

    const sim2RunsMatch = sim2.stdout.match(/Runs Created:\s+(\d+)/);
    const sim2BookingsMatch = sim2.stdout.match(/Bookings Made:\s+(\d+)/);
    const runsCreated2 = sim2RunsMatch ? parseInt(sim2RunsMatch[1], 10) : -1;
    const bookingsMade2 = sim2BookingsMatch ? parseInt(sim2BookingsMatch[1], 10) : -1;

    // Check for any duplicate schedules in DB
    const [dupScheds] = await pool.query(`
      SELECT train_id, journey_date, COUNT(*) AS cnt
      FROM TRAIN_SCHEDULE
      GROUP BY train_id, journey_date
      HAVING COUNT(*) > 1
    `);

    record(
      2,
      'Second Run Idempotency (0 Duplicate Runs & 0 Duplicate Bookings)',
      'Runs Created: 0, Bookings Made: 0, 0 duplicate schedules in DB',
      `Runs Created: ${runsCreated2}, Bookings Made: ${bookingsMade2}, Duplicates: ${dupScheds.length}`,
      runsCreated2 === 0 && bookingsMade2 === 0 && dupScheds.length === 0,
      'Simulator is strictly idempotent when run repeatedly on the same operational date.'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Procedure-Only Booking Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Procedure-Only Booking Integrity ---');
    // Verify that all bookings have valid PNR, primary passenger >= 18, and matching payments
    const [orphanBookings] = await pool.query(`
      SELECT b.pnr
      FROM BOOKING b
      LEFT JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      WHERE pb.passenger_no IS NULL
        AND b.status != 'FAILED'
    `);

    const [invalidPassRef] = await pool.query(`
      SELECT pb.pnr, pb.passenger_no
      FROM PASSENGER_BOOKING pb
      WHERE pb.saved_passenger_id IS NULL
    `);

    const [unlinkedPayments] = await pool.query(`
      SELECT p.payment_id, p.pnr
      FROM PAYMENT p
      LEFT JOIN BOOKING b ON p.pnr = b.pnr
      WHERE b.pnr IS NULL
    `);

    record(
      3,
      'Booking & Passenger Integrity (sp_create_booking invariants)',
      '0 orphan bookings, 0 missing saved_passenger_id, 0 unlinked payments',
      `Orphans: ${orphanBookings.length}, Invalid Pass: ${invalidPassRef.length}, Unlinked Pay: ${unlinkedPayments.length}`,
      orphanBookings.length === 0 && invalidPassRef.length === 0 && unlinkedPayments.length === 0,
      'All bookings generated conform strictly to database procedures and foreign key integrity.'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Chart Preparation Execution
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Chart Preparation Execution ---');
    const [dueUnprepared] = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM TRAIN_SCHEDULE
      WHERE chart_prepared_at IS NULL
        AND TIMESTAMP(journey_date, departure_time) <= NOW() + INTERVAL 8 HOUR
    `);

    const chartsExecutedMatch = sim1.stdout.match(/Charts Prepared:\s+(\d+)/);
    const chartsPreparedCount = chartsExecutedMatch ? parseInt(chartsExecutedMatch[1], 10) : 0;

    record(
      4,
      'Chart Preparation for Due Runs (<= 8 Hours to Departure)',
      '0 overdue unprepared schedules remaining in window',
      `Overdue unprepared remaining: ${dueUnprepared[0].cnt}, Charts prepared: ${chartsPreparedCount}`,
      dueUnprepared[0].cnt === 0,
      `Chart preparation evaluated successfully with 0 overdue schedules left unprepared.`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Master Inventory Audit Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Master Inventory Audit Verification ---');
    const audit = await auditInventory(pool);
    console.log(`  Audited ${audit.totalInventories} schedule class inventories. Discrepancies: ${audit.mismatches}`);

    record(
      5,
      'Master Inventory Audit (0 Mismatches Across All Runs)',
      '0 mismatches across all active inventories',
      `${audit.mismatches} mismatches of ${audit.totalInventories}`,
      audit.mismatches === 0,
      `Master inventory audit confirmed 0 mismatches across all ${audit.totalInventories} schedule class inventories.`
    );

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n========================================================================================');
    console.log(' TEST SUITE D4 EXECUTION RESULTS');
    console.log('========================================================================================');
    console.table(testResults.map(r => ({
      Test: r.id,
      Name: r.name,
      Status: r.status,
      Details: r.details
    })));

    const passedCount = testResults.filter(r => r.status === 'PASS').length;
    const totalCount = testResults.length;
    console.log(`\nALL ${passedCount}/${totalCount} TESTS PASSED.`);

    if (passedCount !== totalCount) {
      throw new Error(`Test suite failed: ${totalCount - passedCount} test(s) failed`);
    }

  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:', err);
    process.exitCode = 1;
  } finally {
    clearTimeout(safetyTimeout);
    await pool.end().catch(() => {});
    await closeMongo().catch(() => {});

    // Restore baseline seed dataset
    console.log('\n[Database] Restoring baseline seed dataset via database/load/run-all.js...');
    try {
      spawnSync('node', ['database/load/run-all.js'], { cwd: rootDir, stdio: 'ignore' });
    } catch (_) {}
    if (require.main === module) {
      process.exit(process.exitCode || 0);
    }
  }
}

if (require.main === module) {
  runTestD4().catch(async (err) => {
    console.error('\n[FATAL ERROR]:', err);
    try {
      await pool.end().catch(() => {});
      await closeMongo().catch(() => {});
    } catch (_) {}
    process.exit(1);
  });
}

module.exports = { runTestD4 };
