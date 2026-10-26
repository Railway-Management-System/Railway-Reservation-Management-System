/**
 * Demo Chain Preparation Script
 * File: backend/scripts/demo-chain.js
 * 
 * Fills a single run on or after 29 Oct 2026 to create a complete promotion chain:
 * - All seats CONFIRMED
 * - RAC queue completely filled
 * - At least 3 WAITING_LIST passengers
 * 
 * Enables live cancellation and TDR promotion demonstrations.
 * Uses only existing stored procedures (sp_create_counter_booking / sp_create_booking).
 * Safe to execute multiple times (idempotent: detects existing chain and displays details).
 */

const pool = require('../src/config/mysql');
const { auditInventory } = require('./helpers/simulationHelper');

async function main() {
  console.log('================================================================================');
  console.log(' RAILWAY RESERVATION SYSTEM - DEMO CHAIN BUILDER');
  console.log('================================================================================\n');

  try {
    // 1. Check if a completed demo chain already exists on any run >= 2026-10-29
    const [existingChainRows] = await pool.query(`
      SELECT 
        ts.schedule_id,
        ts.train_id,
        t.train_number,
        t.display_name AS train_name,
        DATE_FORMAT(ts.journey_date, '%Y-%m-%d') AS journey_date,
        sci.class_id,
        sc.class_name,
        sc.class_code,
        sci.total_seats,
        sci.available_seats,
        sci.rac_capacity,
        sci.rac_count,
        sci.wl_capacity,
        sci.wl_count,
        (sci.total_seats + sci.rac_capacity + sci.wl_capacity) AS total_capacity
      FROM TRAIN_SCHEDULE ts
      JOIN TRAIN t ON ts.train_id = t.train_id
      JOIN SCHEDULE_CLASS_INVENTORY sci ON ts.schedule_id = sci.schedule_id
      JOIN SEAT_CLASS sc ON sci.class_id = sc.class_id
      WHERE ts.journey_date >= '2026-10-29'
        AND ts.chart_prepared_at IS NULL
        AND sci.rac_capacity > 0
        AND sci.available_seats = 0
        AND sci.rac_count >= sci.rac_capacity
        AND sci.wl_count >= 3
      ORDER BY total_capacity ASC, ts.journey_date ASC, ts.schedule_id ASC, sci.class_id ASC
      LIMIT 1
    `);

    let targetRun = null;

    if (existingChainRows.length > 0) {
      targetRun = existingChainRows[0];
      console.log(`[demo:chain] Existing demo chain detected on schedule ${targetRun.schedule_id}.`);
      console.log(`  - Train:         ${targetRun.train_number} - ${targetRun.train_name}`);
      console.log(`  - Travel Date:   ${targetRun.journey_date}`);
      console.log(`  - Class:         ${targetRun.class_name} (${targetRun.class_code})`);
      console.log(`  - Seat Status:   0 available / ${targetRun.total_seats} confirmed`);
      console.log(`  - RAC Status:    ${targetRun.rac_count}/${targetRun.rac_capacity} (Full)`);
      console.log(`  - WL Status:     ${targetRun.wl_count}/${targetRun.wl_capacity} (>= 3 WL)`);
      console.log('  - No new bookings needed. Re-displaying demo chain details.\n');
    } else {
      // 2. Select candidate run: departure >= 2026-10-29, chart not prepared, class with smallest capacity & rac_capacity > 0
      const [candidates] = await pool.query(`
        SELECT 
          ts.schedule_id,
          ts.train_id,
          t.train_number,
          t.display_name AS train_name,
          DATE_FORMAT(ts.journey_date, '%Y-%m-%d') AS journey_date,
          sci.class_id,
          sc.class_name,
          sc.class_code,
          sci.total_seats,
          sci.available_seats,
          sci.rac_capacity,
          sci.rac_count,
          sci.wl_capacity,
          sci.wl_count,
          (sci.total_seats + sci.rac_capacity + sci.wl_capacity) AS total_capacity
        FROM TRAIN_SCHEDULE ts
        JOIN TRAIN t ON ts.train_id = t.train_id
        JOIN SCHEDULE_CLASS_INVENTORY sci ON ts.schedule_id = sci.schedule_id
        JOIN SEAT_CLASS sc ON sci.class_id = sc.class_id
        WHERE ts.journey_date >= '2026-10-29'
          AND ts.chart_prepared_at IS NULL
          AND sci.rac_capacity > 0
          AND sci.available_seats > 0
        ORDER BY total_capacity ASC, ts.journey_date ASC, ts.schedule_id ASC, sci.class_id ASC
        LIMIT 1
      `);

      if (candidates.length === 0) {
        throw new Error('No candidate schedule found on or after 2026-10-29 with available seats and RAC capacity.');
      }

      targetRun = candidates[0];
      console.log(`[demo:chain] Selected target schedule for demo chain:`);
      console.log(`  - Schedule ID:   ${targetRun.schedule_id}`);
      console.log(`  - Train:         ${targetRun.train_number} (${targetRun.train_name})`);
      console.log(`  - Travel Date:   ${targetRun.journey_date}`);
      console.log(`  - Class:         ${targetRun.class_name} (${targetRun.class_code})`);
      console.log(`  - Total Seats:   ${targetRun.total_seats} (Currently Available: ${targetRun.available_seats})`);
      console.log(`  - RAC Capacity:  ${targetRun.rac_capacity} (Current RAC: ${targetRun.rac_count})`);
      console.log(`  - WL Capacity:   ${targetRun.wl_capacity} (Current WL: ${targetRun.wl_count})`);
      console.log(`  - Total Cap:     ${targetRun.total_capacity}\n`);

      // 3. Resolve route stops (origin to terminus)
      const [stops] = await pool.query(`
        SELECT stop_id, station_id, stop_sequence
        FROM ROUTE_STOP
        WHERE train_id = ?
        ORDER BY stop_sequence ASC
      `, [targetRun.train_id]);

      if (stops.length < 2) {
        throw new Error(`Insufficient route stops for train ${targetRun.train_id}`);
      }
      const fromStopId = stops[0].stop_id;
      const toStopId = stops[stops.length - 1].stop_id;

      // 4. Resolve staff ID for counter booking procedure
      const [staffRows] = await pool.query('SELECT staff_id FROM STAFF WHERE status = "ACTIVE" LIMIT 1');
      const staffId = staffRows.length > 0 ? staffRows[0].staff_id : 1;

      // 5. Fetch pool of distinct active passenger accounts who can book (respecting monthly ticket limit)
      const [userPaxRows] = await pool.query(`
        SELECT 
          u.user_id, 
          u.email, 
          sp.passenger_id, 
          sp.name, 
          sp.age, 
          sp.gender, 
          sp.id_proof_type, 
          sp.id_proof_reference
        FROM USER_ACCOUNT u
        JOIN SAVED_PASSENGER sp ON u.user_id = sp.user_id
        WHERE u.role = 'PASSENGER' 
          AND u.account_status = 'ACTIVE'
          AND sp.age >= 18
          AND fn_check_monthly_ticket_limit(u.user_id, NOW()) = 1
        ORDER BY u.user_id ASC
        LIMIT 1000
      `);

      // Deduplicate by user_id so every booking is made by a different user (1 passenger per booking)
      const userPaxPool = [];
      const seenUsers = new Set();
      for (const row of userPaxRows) {
        if (!seenUsers.has(row.user_id)) {
          seenUsers.add(row.user_id);
          userPaxPool.push(row);
        }
      }

      if (userPaxPool.length === 0) {
        throw new Error('No eligible passenger users with adult saved passengers found.');
      }

      console.log(`[demo:chain] Active user pool size: ${userPaxPool.length} users`);
      console.log('[demo:chain] Booking passengers one-by-one via sp_create_counter_booking...');

      let poolIdx = 0;
      let bookingsCreated = 0;

      while (true) {
        // Check current class inventory
        const [currRows] = await pool.query(
          'SELECT available_seats, rac_capacity, rac_count, wl_capacity, wl_count FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = ? AND class_id = ?',
          [targetRun.schedule_id, targetRun.class_id]
        );
        const curr = currRows[0];

        // Stopping condition: seats full (available = 0), RAC full (rac_count >= rac_capacity), and >= 3 WL passengers
        if (curr.available_seats === 0 && curr.rac_count >= curr.rac_capacity && curr.wl_count >= 3) {
          console.log(`  -> Chain completed: 0 available seats, RAC full (${curr.rac_count}/${curr.rac_capacity}), and ${curr.wl_count} waitlist passengers.\n`);
          break;
        }

        if (curr.wl_count >= curr.wl_capacity) {
          console.log(`  -> Reached max WL capacity (${curr.wl_count}/${curr.wl_capacity}). Stopping.`);
          break;
        }

        if (poolIdx >= userPaxPool.length) {
          throw new Error(`Exhausted user pool after ${bookingsCreated} bookings without reaching target state.`);
        }

        const candidateUser = userPaxPool[poolIdx++];
        const passengers = [{
          saved_passenger_id: candidateUser.passenger_id,
          name: candidateUser.name,
          age: candidateUser.age,
          gender: candidateUser.gender,
          concession_type: 'NONE',
          concession_proof_type: candidateUser.id_proof_type || 'AADHAAR',
          concession_proof_ref: candidateUser.id_proof_reference || `ID-${candidateUser.passenger_id}`,
          berth_preference: 'NO_BERTH'
        }];

        // Execute counter booking stored procedure (safest atomic creation with immediate confirmation)
        const [callResult] = await pool.query(
          `CALL sp_create_counter_booking(
             ?, ?, ?, ?, ?, ?, 'GENERAL', ?, 'CASH', 1,
             @out_pnr, @out_total_fare, @out_status, @out_error_code
           );
           SELECT @out_pnr AS pnr, @out_total_fare AS total_fare, @out_status AS status, @out_error_code AS error_code;`,
          [
            staffId,
            candidateUser.user_id,
            targetRun.schedule_id,
            targetRun.class_id,
            fromStopId,
            toStopId,
            JSON.stringify(passengers)
          ]
        );

        let output = null;
        if (Array.isArray(callResult)) {
          for (const r of callResult) {
            if (Array.isArray(r) && r.length > 0 && (r[0].pnr !== undefined || r[0].error_code !== undefined)) {
              output = r[0];
              break;
            }
          }
        }

        if (!output || output.error_code || !output.pnr) {
          throw new Error(`Booking failed for user ${candidateUser.user_id}: ${output ? output.error_code : 'Unknown error'}`);
        }

        bookingsCreated++;
      }

      console.log(`[demo:chain] Total new bookings created: ${bookingsCreated}\n`);
    }

    // 6. Query demo PNRs
    // A. One CONFIRMED PNR and its owner's email (to log in as and cancel)
    const [confirmedRows] = await pool.query(`
      SELECT b.pnr, u.email, u.full_name
      FROM BOOKING b
      JOIN USER_ACCOUNT u ON b.user_id = u.user_id
      JOIN RESERVATION r ON b.pnr = r.pnr
      WHERE b.schedule_id = ?
        AND b.class_id = ?
        AND b.status = 'CONFIRMED'
        AND r.status = 'CONFIRMED'
      ORDER BY b.pnr ASC
      LIMIT 1
    `, [targetRun.schedule_id, targetRun.class_id]);

    // B. First RAC PNR
    const [racRows] = await pool.query(`
      SELECT b.pnr, r.queue_position
      FROM BOOKING b
      JOIN RESERVATION r ON b.pnr = r.pnr
      WHERE b.schedule_id = ?
        AND b.class_id = ?
        AND r.status = 'RAC'
      ORDER BY 
        CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) ASC,
        r.res_id ASC
      LIMIT 1
    `, [targetRun.schedule_id, targetRun.class_id]);

    // C. First WAITING_LIST PNR
    const [wlRows] = await pool.query(`
      SELECT b.pnr, r.queue_position
      FROM BOOKING b
      JOIN RESERVATION r ON b.pnr = r.pnr
      WHERE b.schedule_id = ?
        AND b.class_id = ?
        AND r.status = 'WAITING_LIST'
      ORDER BY 
        CAST(SUBSTRING_INDEX(r.queue_position, '/', -1) AS UNSIGNED) ASC,
        r.res_id ASC
      LIMIT 1
    `, [targetRun.schedule_id, targetRun.class_id]);

    const confirmedPnr = confirmedRows.length > 0 ? confirmedRows[0].pnr : 'NONE';
    const confirmedEmail = confirmedRows.length > 0 ? confirmedRows[0].email : 'NONE';
    const firstRacPnr = racRows.length > 0 ? `${racRows[0].pnr} (${racRows[0].queue_position})` : 'NONE';
    const firstWlPnr = wlRows.length > 0 ? `${wlRows[0].pnr} (${wlRows[0].queue_position})` : 'NONE';

    console.log('================================================================================');
    console.log(' DEMO PROMOTION CHAIN SUMMARY');
    console.log('================================================================================');
    console.log(`Train Number & Name: ${targetRun.train_number} - ${targetRun.train_name}`);
    console.log(`Schedule ID:         ${targetRun.schedule_id}`);
    console.log(`Travel Date:         ${targetRun.journey_date}`);
    console.log(`Class Name:          ${targetRun.class_name} (${targetRun.class_code})`);
    console.log(`Confirmed PNR:       ${confirmedPnr} [TO CANCEL]`);
    console.log(`Owner Login Email:   ${confirmedEmail}`);
    console.log(`First RAC PNR:       ${firstRacPnr}`);
    console.log(`First WL PNR:        ${firstWlPnr}`);
    console.log('================================================================================\n');

    // 7. Inventory Audit
    console.log('>>> Running Master Inventory Audit...');
    const audit = await auditInventory(pool);
    console.log(`  - Total Schedules Audited: ${audit.totalInventories}`);
    console.log(`  - Inventory Mismatches:    ${audit.mismatches}`);

    if (audit.mismatches > 0) {
      console.error('\n[AUDIT FAILED]: Discrepancies detected:', JSON.stringify(audit.mismatchDetails, null, 2));
      throw new Error(`Inventory audit failed with ${audit.mismatches} mismatches`);
    }

    console.log('  - Audit Result: 0 mismatches (Master inventory perfectly synchronized)\n');

  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n[DEMO-CHAIN FATAL ERROR]:', err);
    process.exit(1);
  });
}

module.exports = { main };
