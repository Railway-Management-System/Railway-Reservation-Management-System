/**
 * Daily Operations Simulator
 * File: backend/scripts/simulate-daily.js
 * 
 * Advances the operational rolling window (today to today+6), creates missing train runs,
 * generates realistic bookings adhering to demo_fill_plan.csv, processes random cancellations,
 * executes chart preparation for schedules reaching chart time, and audits master inventory.
 */

const pool = require('../src/config/mysql');
const { connectMongo, closeMongo } = require('../src/config/mongodb');
const {
  formatDate,
  getDateWindow,
  createRunsForWindow,
  fillScheduleBookings,
  FILL_SPREAD_PATTERNS,
  performRandomCancellations,
  prepareDueCharts,
  auditInventory
} = require('./helpers/simulationHelper');

async function runSimulator() {
  console.log('================================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - DAILY OPERATIONS SIMULATOR');
  console.log('================================================================================\n');

  await connectMongo();

  try {
    // 1. Determine base date ('today')
    let todayStr = formatDate(new Date());
    for (const arg of process.argv) {
      if (arg.startsWith('--today=')) {
        todayStr = arg.split('=')[1].trim();
      }
    }

    const windowDates = getDateWindow(todayStr, 7);
    console.log(`[Simulator] Operating window: ${windowDates[0]} to ${windowDates[windowDates.length - 1]} (7 days)`);
    console.log(`[Simulator] Reference base date: ${todayStr}`);

    // 2. Create missing runs for each train running on that weekday
    console.log('\n>>> Step 1: Synchronizing train schedules and class inventory...');
    const { runsCreated, createdSchedules } = await createRunsForWindow(pool, windowDates);
    console.log(`  - New runs created: ${runsCreated}`);

    // 3. Generate bookings for newly created runs / empty runs in window
    console.log('\n>>> Step 2: Generating bookings for active schedules...');
    const [passengerPool] = await pool.query(
      'SELECT passenger_id, name, age, gender, id_proof_type, id_proof_reference FROM SAVED_PASSENGER WHERE age >= 18 LIMIT 1000'
    );
    const [userPool] = await pool.query(
      'SELECT user_id FROM USER_ACCOUNT WHERE role = "PASSENGER" LIMIT 1000'
    );

    let totalBookingsMade = 0;
    // Check which days in the window have NO bookings at all (newly created days)
    const [daysWithBookings] = await pool.query(`
      SELECT DISTINCT DATE_FORMAT(ts.journey_date, '%Y-%m-%d') AS jd
      FROM TRAIN_SCHEDULE ts
      JOIN BOOKING b ON ts.schedule_id = b.schedule_id
      WHERE ts.journey_date IN (?)
    `, [windowDates]);
    const filledDatesSet = new Set(daysWithBookings.map(r => r.jd));

    const newDays = windowDates.filter(d => !filledDatesSet.has(d));
    console.log(`  - Days requiring initial booking generation: ${newDays.length > 0 ? newDays.join(', ') : 'None (all days have bookings)'}`);

    if (newDays.length > 0) {
      const [candidateSchedules] = await pool.query(`
        SELECT schedule_id, train_id, DATE_FORMAT(journey_date, '%Y-%m-%d') AS jd
        FROM TRAIN_SCHEDULE
        WHERE journey_date IN (?)
        ORDER BY journey_date ASC, schedule_id ASC
      `, [newDays]);

      const schedulesByDate = {};
      for (const s of candidateSchedules) {
        if (!schedulesByDate[s.jd]) schedulesByDate[s.jd] = [];
        schedulesByDate[s.jd].push(s);
      }

      let patternIdx = 0;
      for (const jd of newDays) {
        const dayScheds = schedulesByDate[jd] || [];
        // Fill a realistic spread of ~8 runs per day matching demo_fill_plan.csv, leaving the rest empty
        const sample = dayScheds.slice(0, 8);
        for (const sched of sample) {
          const fillLevel = FILL_SPREAD_PATTERNS[patternIdx % FILL_SPREAD_PATTERNS.length];
          patternIdx++;
          const { bookingsCount } = await fillScheduleBookings(pool, sched.schedule_id, fillLevel, passengerPool, userPool);
          totalBookingsMade += bookingsCount;
        }
      }
    }
    console.log(`  - Total bookings created across new runs: ${totalBookingsMade}`);

    // 4. Perform random cancellations on future runs
    console.log('\n>>> Step 3: Executing random passenger cancellations...');
    const cancellationsCount = await performRandomCancellations(pool, 5);
    console.log(`  - Passenger cancellations executed: ${cancellationsCount}`);

    // 5. Chart preparation for runs reaching chart time (<= 8 hours before departure)
    console.log('\n>>> Step 4: Executing chart preparation for due runs...');
    const chartsPrepared = await prepareDueCharts(pool);
    console.log(`  - Charts prepared: ${chartsPrepared}`);

    // 6. Master Inventory Verification Audit
    console.log('\n>>> Step 5: Running Master Inventory Audit...');
    const audit = await auditInventory(pool);
    console.log(`  - Total Schedule Class Inventories Audited: ${audit.totalInventories}`);
    console.log(`  - Inventory Mismatches: ${audit.mismatches}`);

    if (audit.mismatches > 0) {
      console.error('\n[AUDIT FAILED]: Found inventory discrepancies:', JSON.stringify(audit.mismatchDetails, null, 2));
      throw new Error(`Inventory audit failed with ${audit.mismatches} mismatches`);
    }

    // 7. Print Final Summary Table
    console.log('\n================================================================================');
    console.log(' SIMULATOR EXECUTION SUMMARY');
    console.log('================================================================================');
    console.log(`Window:              ${windowDates[0]} to ${windowDates[windowDates.length - 1]} (${windowDates.length} days)`);
    console.log(`Runs Created:        ${runsCreated}`);
    console.log(`Bookings Made:       ${totalBookingsMade}`);
    console.log(`Cancellations:       ${cancellationsCount}`);
    console.log(`Charts Prepared:     ${chartsPrepared}`);
    console.log(`Inventory Audit:     0 mismatches of ${audit.totalInventories}`);
    console.log('================================================================================\n');

  } finally {
    await pool.end();
    await closeMongo();
  }
}

if (require.main === module) {
  runSimulator().catch((err) => {
    console.error('[SIMULATOR ERROR]:', err);
    process.exit(1);
  });
}

module.exports = { runSimulator };
