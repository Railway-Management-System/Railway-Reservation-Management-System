/**
 * Railway Reservation System - Schedule & Date-Proof Helper
 * File: backend/scripts/helpers/scheduleHelper.js
 * 
 * Provides utilities for test suites to pick or generate valid future runs
 * and dates, ensuring test suites remain completely date-proof and resilient.
 */

const {
  formatDate,
  parseDate,
  getDateWindow,
  ensureRunExists,
  createRunsForWindow,
  auditInventory
} = require('./simulationHelper');

/**
 * Returns a future date string YYYY-MM-DD offset by offsetDays from today (or from baseDate)
 */
function getFutureDate(offsetDays = 2, baseDate = null) {
  const d = baseDate ? (typeof baseDate === 'string' ? parseDate(baseDate) : new Date(baseDate)) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDate(d);
}

/**
 * Finds an existing future schedule for trainId that has not departed and not chart-prepared,
 * or ensures that a clean future run exists on a future date.
 * 
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} trainId
 * @param {number} offsetDays
 * @returns {Promise<{ scheduleId: number, journeyDate: string, departureTime: string }>}
 */
async function getOrEnsureFutureSchedule(pool, trainId, offsetDays = 2) {
  const [existing] = await pool.query(`
    SELECT schedule_id, DATE_FORMAT(journey_date, '%Y-%m-%d') AS journey_date, departure_time
    FROM TRAIN_SCHEDULE
    WHERE train_id = ?
      AND chart_prepared_at IS NULL
      AND TIMESTAMP(journey_date, departure_time) > NOW() + INTERVAL 2 HOUR
    ORDER BY journey_date ASC
    LIMIT 1
  `, [trainId]);

  if (existing.length > 0) {
    return {
      scheduleId: existing[0].schedule_id,
      journeyDate: existing[0].journey_date,
      departureTime: existing[0].departure_time
    };
  }

  // Create a run for a future date
  const futureDate = getFutureDate(offsetDays);
  const res = await ensureRunExists(pool, trainId, futureDate);
  const [sRow] = await pool.query(
    'SELECT departure_time FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
    [res.scheduleId]
  );

  return {
    scheduleId: res.scheduleId,
    journeyDate: futureDate,
    departureTime: sRow[0].departure_time
  };
}

module.exports = {
  formatDate,
  parseDate,
  getDateWindow,
  getFutureDate,
  ensureRunExists,
  createRunsForWindow,
  getOrEnsureFutureSchedule,
  auditInventory
};
