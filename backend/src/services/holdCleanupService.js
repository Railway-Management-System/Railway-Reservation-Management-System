const pool = require('../config/mysql');

let timer = null;

/**
 * Executes stored procedure sp_release_expired_holds to release PAYMENT_PENDING bookings
 * whose seat hold has lapsed (HOLD_MINUTES).
 * Logs only the count of holds released.
 */
async function releaseExpiredHolds() {
  try {
    const [rows] = await pool.query('CALL sp_release_expired_holds(1, @count); SELECT @count AS released;');
    let count = 0;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (Array.isArray(r) && r.length > 0 && r[0].released !== undefined) {
          count = Number(r[0].released);
          break;
        }
      }
    }
    if (count > 0) {
      console.log(`Released holds: ${count}`);
    }
    return count;
  } catch (err) {
    console.error('Error running sp_release_expired_holds:', err.message);
    return 0;
  }
}

/**
 * Starts the recurring background timer calling sp_release_expired_holds every intervalMs (default 60s).
 */
function startCleanupTimer(intervalMs = 60000) {
  if (timer) return timer;
  timer = setInterval(releaseExpiredHolds, intervalMs);
  return timer;
}

/**
 * Stops the recurring background cleanup timer.
 */
function stopCleanupTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  releaseExpiredHolds,
  startCleanupTimer,
  stopCleanupTimer
};
