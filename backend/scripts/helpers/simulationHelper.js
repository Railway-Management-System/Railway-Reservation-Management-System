/**
 * Simulation Helper Functions
 * Shared between backend/scripts/simulate-daily.js and test suites.
 */

const { prepareChartForSchedule } = require('../../src/services/chartPreparationService');

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Format Date object as YYYY-MM-DD in India / local time
 */
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string into Date object at noon to avoid timezone rollover
 */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Return array of YYYY-MM-DD date strings for [baseDate, ..., baseDate + days - 1]
 */
function getDateWindow(baseDateStr, days = 7) {
  const result = [];
  const start = parseDate(baseDateStr);
  for (let i = 0; i < days; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    result.push(formatDate(cur));
  }
  return result;
}

/**
 * Ensures a train schedule exists for (trainId, journeyDateStr).
 * If missing, creates TRAIN_SCHEDULE, RUN_COACH_STATUS and SCHEDULE_CLASS_INVENTORY.
 * Safe to call multiple times (idempotent).
 * 
 * @param {import('mysql2/promise').Pool} pool 
 * @param {number} trainId 
 * @param {string} journeyDateStr 
 * @returns {Promise<{ scheduleId: number, created: boolean }>}
 */
async function ensureRunExists(pool, trainId, journeyDateStr) {
  // 1. Check if run already exists
  const [existing] = await pool.query(
    'SELECT schedule_id FROM TRAIN_SCHEDULE WHERE train_id = ? AND journey_date = ?',
    [trainId, journeyDateStr]
  );
  if (existing.length > 0) {
    return { scheduleId: existing[0].schedule_id, created: false };
  }

  // 2. Fetch origin departure time
  const [depRows] = await pool.query(
    'SELECT departure_time FROM ROUTE_STOP WHERE train_id = ? AND stop_sequence = 1',
    [trainId]
  );
  if (depRows.length === 0) {
    throw new Error(`Route stop sequence 1 not found for train ${trainId}`);
  }
  const depTime = depRows[0].departure_time;

  // 3. Fetch coaches for this train
  const [coaches] = await pool.query(
    'SELECT coach_id, class_id, total_seats FROM COACH WHERE train_id = ? ORDER BY coach_id ASC',
    [trainId]
  );
  if (coaches.length === 0) {
    throw new Error(`No coaches found for train ${trainId}`);
  }

  // Calculate class totals
  const classTotals = {};
  for (const c of coaches) {
    classTotals[c.class_id] = (classTotals[c.class_id] || 0) + c.total_seats;
  }

  // 4. Allocate IDs sequentially inside transaction
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [maxSched] = await conn.query('SELECT COALESCE(MAX(schedule_id), 1000) AS maxId FROM TRAIN_SCHEDULE FOR UPDATE');
    const [maxStatus] = await conn.query('SELECT COALESCE(MAX(status_id), 0) AS maxId FROM RUN_COACH_STATUS FOR UPDATE');
    const [maxInv] = await conn.query('SELECT COALESCE(MAX(inventory_id), 0) AS maxId FROM SCHEDULE_CLASS_INVENTORY FOR UPDATE');

    const newSchedId = maxSched[0].maxId + 1;
    let nextStatusId = maxStatus[0].maxId + 1;
    let nextInvId = maxInv[0].maxId + 1;

    // Insert TRAIN_SCHEDULE
    await conn.query(
      'INSERT INTO TRAIN_SCHEDULE (schedule_id, train_id, journey_date, departure_time, delay_minutes, chart_prepared_at, status) VALUES (?, ?, ?, ?, 0, NULL, "ON_TIME")',
      [newSchedId, trainId, journeyDateStr, depTime]
    );

    // Insert RUN_COACH_STATUS
    for (const c of coaches) {
      await conn.query(
        'INSERT INTO RUN_COACH_STATUS (status_id, schedule_id, coach_id, status) VALUES (?, ?, ?, "IN_SERVICE")',
        [nextStatusId++, newSchedId, c.coach_id]
      );
    }

    // Insert SCHEDULE_CLASS_INVENTORY
    for (const [clsIdStr, totSeats] of Object.entries(classTotals)) {
      const cId = parseInt(clsIdStr, 10);
      const offersRac = (cId === 2 || cId === 3 || cId === 4);
      const racCap = offersRac ? Math.round(totSeats * 0.10) : 0;
      const wlCap = Math.round(totSeats * 0.25);

      await conn.query(
        'INSERT INTO SCHEDULE_CLASS_INVENTORY (inventory_id, schedule_id, class_id, total_seats, available_seats, rac_capacity, rac_count, wl_capacity, wl_count) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)',
        [nextInvId++, newSchedId, cId, totSeats, totSeats, racCap, wlCap]
      );
    }

    await conn.commit();
    conn.release();
    return { scheduleId: newSchedId, created: true };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

/**
 * Creates missing runs across all active trains for the given date window.
 */
async function createRunsForWindow(pool, dateList) {
  const [trains] = await pool.query('SELECT train_id, train_number, running_days FROM TRAIN ORDER BY train_id ASC');
  let runsCreated = 0;
  const createdSchedules = [];

  for (const dateStr of dateList) {
    const d = parseDate(dateStr);
    const dayCode = DAY_NAMES[d.getDay()];

    for (const t of trains) {
      let rDays = [];
      try {
        rDays = typeof t.running_days === 'string' ? JSON.parse(t.running_days) : t.running_days;
      } catch (_) {
        rDays = [];
      }

      if (Array.isArray(rDays) && rDays.includes(dayCode)) {
        const res = await ensureRunExists(pool, t.train_id, dateStr);
        if (res.created) {
          runsCreated++;
          createdSchedules.push({ scheduleId: res.scheduleId, trainId: t.train_id, journeyDate: dateStr });
        }
      }
    }
  }

  return { runsCreated, createdSchedules };
}

/**
 * Fill spread pattern based on demo_fill_plan.csv
 */
const FILL_SPREAD_PATTERNS = [
  'EMPTY', 'LIGHT', 'EMPTY', 'MEDIUM', 'LIGHT', 'EMPTY', 'BUSY',
  'LIGHT', 'EMPTY', 'NEARLY_FULL', 'EMPTY', 'MEDIUM', 'LIGHT', 'RAC_OPEN',
  'EMPTY', 'LIGHT', 'MEDIUM', 'WL', 'EMPTY', 'LIGHT', 'BUSY'
];

/**
 * Create realistic bookings for a newly created schedule following demo_fill_plan.csv
 */
async function fillScheduleBookings(pool, scheduleId, fillLevel, passengerPool, userPool) {
  if (!fillLevel || fillLevel === 'EMPTY') {
    return { bookingsCount: 0 };
  }

  // Check if schedule already has bookings
  const [bCheck] = await pool.query('SELECT COUNT(*) AS cnt FROM BOOKING WHERE schedule_id = ?', [scheduleId]);
  if (bCheck[0].cnt > 0) {
    return { bookingsCount: 0 };
  }

  // Get train and stops
  const [schedInfo] = await pool.query(
    'SELECT train_id, journey_date FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
    [scheduleId]
  );
  if (schedInfo.length === 0) return { bookingsCount: 0 };
  const trainId = schedInfo[0].train_id;

  const [stops] = await pool.query(
    'SELECT stop_id FROM ROUTE_STOP WHERE train_id = ? ORDER BY stop_sequence ASC',
    [trainId]
  );
  if (stops.length < 2) return { bookingsCount: 0 };
  const fromStopId = stops[0].stop_id;
  const toStopId = stops[stops.length - 1].stop_id;

  // Get inventories
  const [invs] = await pool.query(
    'SELECT class_id, total_seats, available_seats, rac_capacity, wl_capacity FROM SCHEDULE_CLASS_INVENTORY WHERE schedule_id = ? ORDER BY class_id ASC',
    [scheduleId]
  );

  let bookingsMade = 0;
  let passIdx = Math.floor(Math.random() * passengerPool.length);
  let userIdx = Math.floor(Math.random() * userPool.length);

  // Determine target bookings per class based on fill level
  let targetBookingsPerClass = 1;
  if (fillLevel === 'LIGHT') targetBookingsPerClass = 1;
  else if (fillLevel === 'MEDIUM') targetBookingsPerClass = 2;
  else if (fillLevel === 'BUSY') targetBookingsPerClass = 3;
  else if (fillLevel === 'NEARLY_FULL') targetBookingsPerClass = 4;
  else if (fillLevel === 'RAC_OPEN' || fillLevel === 'WL' || fillLevel === 'RAC_FULL_WL_OPEN' || fillLevel === 'WL_FULL') targetBookingsPerClass = 2;

  for (const inv of invs) {
    const classId = inv.class_id;
    let classBookingsMade = 0;
    let keepBooking = true;

    while (keepBooking && classBookingsMade < targetBookingsPerClass) {
      const groupSize = Math.floor(Math.random() * 2) + 1; // 1 to 2 passengers per booking
      const passengers = [];

      for (let g = 0; g < groupSize; g++) {
        const sp = passengerPool[passIdx % passengerPool.length];
        passIdx++;
        passengers.push({
          saved_passenger_id: sp.passenger_id,
          name: sp.name,
          age: sp.age,
          gender: sp.gender,
          idProofType: sp.id_proof_type || 'AADHAAR',
          idProofReference: sp.id_proof_reference || `ID-${sp.passenger_id}`,
          concessionType: 'NONE',
          berthPreference: 'NO_BERTH'
        });
      }

      const bookUser = userPool[userIdx % userPool.length];
      userIdx++;

      const [res] = await pool.query(
        'CALL sp_create_booking(?, ?, ?, ?, ?, "GENERAL", 1, 0, 0, ?, "ONLINE", NULL, 1, @out_pnr, @out_status, @out_total_fare, @out_error_code); SELECT @out_pnr AS pnr, @out_status AS status, @out_total_fare AS total_fare, @out_error_code AS error_code;',
        [bookUser.user_id, scheduleId, classId, fromStopId, toStopId, JSON.stringify(passengers)]
      );

      let output = null;
      for (const r of res) {
        if (Array.isArray(r) && r.length > 0 && (r[0].pnr !== undefined || r[0].error_code !== undefined)) {
          output = r[0];
          break;
        }
      }

      if (output && output.pnr && !output.error_code) {
        bookingsMade++;
        classBookingsMade++;

        // Insert matching PAYMENT record
        const [maxP] = await pool.query('SELECT COALESCE(MAX(payment_id), 0) AS m FROM PAYMENT');
        const nextPayId = maxP[0].m + 1;
        await pool.query(
          'INSERT INTO PAYMENT (payment_id, pnr, amount, method, status, gateway_payment_id, paid_at) VALUES (?, ?, ?, "UPI", "SUCCESS", ?, NOW())',
          [nextPayId, output.pnr, output.total_fare || 0, `pay_sim_${output.pnr}`]
        );
      } else {
        keepBooking = false;
      }
    }
  }

  return { bookingsCount: bookingsMade };
}

/**
 * Random cancellations on future runs with sp_cancel_passenger_ticket (p_manage_tx=1)
 */
async function performRandomCancellations(pool, count = 5) {
  // Find confirmed bookings on schedules departing > 8 hours in future
  const [eligible] = await pool.query(`
    SELECT b.pnr
    FROM BOOKING b
    JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
    WHERE b.status = 'CONFIRMED'
      AND TIMESTAMP(ts.journey_date, ts.departure_time) > NOW() + INTERVAL 9 HOUR
    ORDER BY b.pnr DESC
    LIMIT ?
  `, [count]);

  let cancelledCount = 0;
  for (const row of eligible) {
    try {
      const [res] = await pool.query(
        'CALL sp_cancel_passenger_ticket(?, NULL, "PASSENGER_REQUEST", 1, @out_charge, @out_refund, @out_status); SELECT @out_status AS status;',
        [row.pnr]
      );
      cancelledCount++;
    } catch (_) {}
  }

  return cancelledCount;
}

/**
 * Prepare charts for schedules that reached chart time (<= 8 hours before origin departure)
 */
async function prepareDueCharts(pool) {
  const [dueSchedules] = await pool.query(`
    SELECT schedule_id
    FROM TRAIN_SCHEDULE
    WHERE chart_prepared_at IS NULL
      AND TIMESTAMP(journey_date, departure_time) <= NOW() + INTERVAL 8 HOUR
    ORDER BY schedule_id ASC
  `);

  let chartsPrepared = 0;
  for (const s of dueSchedules) {
    try {
      const result = await prepareChartForSchedule(s.schedule_id, 1);
      if (result && result.chartPreparedAt) {
        chartsPrepared++;
      }
    } catch (_) {}
  }

  return chartsPrepared;
}

/**
 * Master Inventory Audit Verification
 */
async function auditInventory(pool) {
  const [resRows] = await pool.query(`
    SELECT 
      r.schedule_id,
      b.class_id,
      SUM(CASE WHEN r.status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS confirmed_boarded_count,
      SUM(CASE WHEN r.status = 'RAC' THEN 1 ELSE 0 END) AS rac_count,
      SUM(CASE WHEN r.status = 'WAITING_LIST' THEN 1 ELSE 0 END) AS wl_count
    FROM RESERVATION r
    JOIN BOOKING b ON r.pnr = b.pnr
    GROUP BY r.schedule_id, b.class_id
  `);

  const [invRows] = await pool.query(`
    SELECT schedule_id, class_id, total_seats, available_seats, rac_count, wl_count
    FROM SCHEDULE_CLASS_INVENTORY
  `);

  const resMap = new Map();
  for (const row of resRows) {
    resMap.set(`${row.schedule_id}-${row.class_id}`, row);
  }

  let mismatches = 0;
  const mismatchDetails = [];

  for (const inv of invRows) {
    const key = `${inv.schedule_id}-${inv.class_id}`;
    const res = resMap.get(key) || { confirmed_boarded_count: 0, rac_count: 0, wl_count: 0 };
    const expectedAvail = inv.total_seats - Number(res.confirmed_boarded_count);

    if (
      inv.available_seats !== expectedAvail ||
      Number(inv.rac_count) !== Number(res.rac_count) ||
      Number(inv.wl_count) !== Number(res.wl_count)
    ) {
      mismatches++;
      mismatchDetails.push({
        scheduleId: inv.schedule_id,
        classId: inv.class_id,
        expected: { avail: expectedAvail, rac: Number(res.rac_count), wl: Number(res.wl_count) },
        actual: { avail: inv.available_seats, rac: Number(inv.rac_count), wl: Number(inv.wl_count) }
      });
    }
  }

  return { totalInventories: invRows.length, mismatches, mismatchDetails };
}

module.exports = {
  DAY_NAMES,
  formatDate,
  parseDate,
  getDateWindow,
  ensureRunExists,
  createRunsForWindow,
  fillScheduleBookings,
  FILL_SPREAD_PATTERNS,
  performRandomCancellations,
  prepareDueCharts,
  auditInventory
};
