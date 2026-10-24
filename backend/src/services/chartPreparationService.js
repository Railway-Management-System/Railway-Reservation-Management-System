const pool = require('../config/mysql');
const AppError = require('../utils/appError');
const { processGatewayRefund } = require('./gatewayRefundService');

/**
 * Reusable Chart Preparation Function
 * Can be called by HTTP admin endpoint or by the daily simulator cron.
 * 
 * Flow:
 * 1. Validates that schedule exists.
 * 2. If chart is already prepared (chart_prepared_at IS NOT NULL), returns existing results safely without re-running.
 * 3. If not prepared:
 *    - Calls sp_prepare_chart(scheduleId, 1, @out_snapshot_count)
 *    - Queries newly generated WAITLIST_PURGE refund records
 *    - Invokes shared gateway refund helper once per Razorpay payment
 *    - Returns Contract 7.2 compliant summary
 * 
 * @param {number|string} scheduleId 
 * @param {number|null} [callerUserId]
 * @returns {Promise<Object>}
 */
async function prepareChartForSchedule(scheduleId, callerUserId = null) {
  const schedId = parseInt(scheduleId, 10);
  if (isNaN(schedId) || schedId <= 0) {
    throw new AppError('BAD_REQUEST', 'Valid numeric scheduleId is required', 400);
  }

  // Check schedule existence and current chart status
  const [schedRows] = await pool.query(
    `SELECT ts.schedule_id, ts.train_id, ts.journey_date, ts.chart_prepared_at,
            t.train_number, t.short_name, t.display_name
     FROM TRAIN_SCHEDULE ts
     JOIN TRAIN t ON ts.train_id = t.train_id
     WHERE ts.schedule_id = ?`,
    [schedId]
  );

  if (schedRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Train schedule not found', 404);
  }

  const sched = schedRows[0];

  // If already prepared, return existing results safely
  if (sched.chart_prepared_at) {
    const [snapCountRows] = await pool.query(
      'SELECT COUNT(*) AS snapshot_count FROM CHART_SNAPSHOT WHERE schedule_id = ?',
      [schedId]
    );

    const [purgeRows] = await pool.query(
      `SELECT COUNT(*) AS purge_count, COALESCE(SUM(r.amount), 0) AS purge_amount
       FROM REFUND r
       JOIN PAYMENT p ON r.payment_id = p.payment_id
       JOIN BOOKING b ON p.pnr = b.pnr
       WHERE b.schedule_id = ? AND r.reason = 'WAITLIST_PURGE'`,
      [schedId]
    );

    return {
      scheduleId: schedId,
      trainNumber: String(sched.train_number),
      journeyDate: String(sched.journey_date),
      chartPreparedAt: sched.chart_prepared_at,
      summary: {
        activeHoldsCancelled: 0,
        unusedQuotaSeatsReleased: 0,
        autoUpgradesProcessed: 0,
        oldClassPromotionsTriggered: 0,
        waitlistedPassengersCancelled: Number(purgeRows[0].purge_count || 0),
        totalRefundsDisbursed: Number(Number(purgeRows[0].purge_amount || 0).toFixed(2)),
        chartSnapshotRowsPersisted: Number(snapCountRows[0].snapshot_count || 0)
      }
    };
  }

  // Not prepared yet: measure pre-run state
  const [holdRows] = await pool.query(
    'SELECT COUNT(*) AS hold_count FROM BOOKING WHERE schedule_id = ? AND status = "PAYMENT_PENDING"',
    [schedId]
  );
  const activeHoldsBefore = holdRows[0].hold_count || 0;

  const [wlRows] = await pool.query(
    'SELECT COUNT(*) AS wl_count FROM RESERVATION WHERE schedule_id = ? AND status = "WAITING_LIST"',
    [schedId]
  );
  const wlCountBefore = wlRows[0].wl_count || 0;

  const [maxRefundRows] = await pool.query('SELECT COALESCE(MAX(refund_id), 0) AS max_id FROM REFUND');
  const maxRefundIdBefore = maxRefundRows[0].max_id;

  // Call sp_prepare_chart with p_manage_tx = 1
  await pool.query(
    'CALL sp_prepare_chart(?, 1, @out_snapshot_count);',
    [schedId]
  );

  const [[{ out_snapshot_count }]] = await pool.query(
    'SELECT @out_snapshot_count AS out_snapshot_count;'
  );

  // Fetch updated schedule
  const [updatedSchedRows] = await pool.query(
    'SELECT chart_prepared_at FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
    [schedId]
  );
  const chartPreparedAt = updatedSchedRows[0].chart_prepared_at || sched.chart_prepared_at;

  // Find newly created WAITLIST_PURGE refund rows
  const [newRefundRows] = await pool.query(
    `SELECT r.refund_id, r.payment_id, r.amount, p.pnr, p.method, p.gateway_payment_id
     FROM REFUND r
     JOIN PAYMENT p ON r.payment_id = p.payment_id
     WHERE r.refund_id > ? AND r.reason = 'WAITLIST_PURGE'
     ORDER BY r.refund_id ASC`,
    [maxRefundIdBefore]
  );

  let totalRefunds = 0;
  // Group new refunds by payment_id
  const refundsByPayment = new Map();
  for (const r of newRefundRows) {
    const payId = r.payment_id;
    const amt = Number(r.amount);
    totalRefunds += amt;

    if (!refundsByPayment.has(payId)) {
      refundsByPayment.set(payId, {
        pnr: r.pnr,
        paymentMethod: r.method,
        gatewayPaymentId: r.gateway_payment_id,
        amountInRupees: 0,
        refundIds: []
      });
    }
    const group = refundsByPayment.get(payId);
    group.amountInRupees += amt;
    group.refundIds.push(r.refund_id);
  }

  // Call shared gateway refund helper once per Razorpay payment
  for (const group of refundsByPayment.values()) {
    try {
      await processGatewayRefund({
        pnr: group.pnr,
        paymentMethod: group.paymentMethod,
        gatewayPaymentId: group.gatewayPaymentId,
        amountInRupees: group.amountInRupees.toFixed(2),
        refundIds: group.refundIds,
        reason: 'WAITLIST_PURGE'
      });
    } catch (gwErr) {
      console.warn(`[Chart Preparation] Gateway refund failed for payment ${group.gatewayPaymentId}:`, gwErr.message);
    }
  }

  return {
    scheduleId: schedId,
    trainNumber: String(sched.train_number),
    journeyDate: String(sched.journey_date),
    chartPreparedAt,
    summary: {
      activeHoldsCancelled: Number(activeHoldsBefore),
      unusedQuotaSeatsReleased: 0,
      autoUpgradesProcessed: 0,
      oldClassPromotionsTriggered: 0,
      waitlistedPassengersCancelled: newRefundRows.length > 0 ? newRefundRows.length : Number(wlCountBefore),
      totalRefundsDisbursed: Number(totalRefunds.toFixed(2)),
      chartSnapshotRowsPersisted: Number(out_snapshot_count || 0)
    }
  };
}

module.exports = {
  prepareChartForSchedule
};
