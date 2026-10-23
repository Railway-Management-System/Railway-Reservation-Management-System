const pool = require('../config/mysql');
const AppError = require('../utils/appError');
const { CANONICAL_ERROR_MESSAGES, CANONICAL_ERROR_STATUS_CODES } = require('../middleware/errorHandler');
const { processGatewayRefund } = require('../services/gatewayRefundService');

/**
 * Validates YYYY-MM-DD date format strictly without JS Date
 */
function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(dateStr);
}

/**
 * 4.2 Create Online Booking
 * POST /api/bookings
 * Calls sp_create_booking with p_hold_for_payment = 1 and p_manage_tx = 1.
 */
async function createBooking(req, res, next) {
  try {
    const userId = req.user.user_id || req.user.userId;
    const {
      trainId,
      journeyDate,
      boardingStationId,
      destinationStationId,
      classType,
      quota = 'GENERAL',
      requestedQuota,
      continueWithGeneralQuota = false,
      passengers,
      preferences = {}
    } = req.body;

    if (!trainId || !journeyDate || !boardingStationId || !destinationStationId || !classType) {
      throw new AppError('VALIDATION_ERROR', 'trainId, journeyDate, boardingStationId, destinationStationId, and classType are required', 400);
    }

    if (!isValidDateString(journeyDate)) {
      throw new AppError('VALIDATION_ERROR', 'journeyDate must be in YYYY-MM-DD format', 400);
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one passenger is required', 400);
    }

    if (passengers.length > 6) {
      throw new AppError('VALIDATION_ERROR', 'Maximum 6 passengers allowed per booking', 400);
    }

    // 1. Resolve stop details from ROUTE_STOP
    const [stopRows] = await pool.query(
      `SELECT stop_id, station_id, stop_sequence, day_offset
       FROM ROUTE_STOP
       WHERE train_id = ? AND station_id IN (?, ?)
       ORDER BY stop_sequence ASC`,
      [trainId, boardingStationId, destinationStationId]
    );

    const fromStop = stopRows.find(s => Number(s.station_id) === Number(boardingStationId));
    const toStop = stopRows.find(s => Number(s.station_id) === Number(destinationStationId));

    if (!fromStop || !toStop || fromStop.stop_sequence >= toStop.stop_sequence) {
      throw new AppError('VALIDATION_ERROR', 'Invalid boarding or destination station for this train route', 400);
    }

    // 2. Resolve origin departure date: journeyDate - fromStop.day_offset
    const [originRows] = await pool.query(
      'SELECT DATE_SUB(?, INTERVAL ? DAY) AS origin_date',
      [journeyDate, fromStop.day_offset]
    );
    const originDate = originRows[0].origin_date;

    // 3. Resolve schedule_id from TRAIN_SCHEDULE
    const [scheduleRows] = await pool.query(
      'SELECT schedule_id, chart_prepared_at FROM TRAIN_SCHEDULE WHERE train_id = ? AND journey_date = ?',
      [trainId, originDate]
    );

    if (scheduleRows.length === 0) {
      throw new AppError('TRAIN_NOT_RUNNING', 'The train does not operate on the origin departure date corresponding to the boarding date (BR-B1a).', 400);
    }

    const schedule = scheduleRows[0];
    if (schedule.chart_prepared_at) {
      throw new AppError('CHART_PREPARED', 'Booking attempted at or after chart preparation time (BR-B12a).', 400);
    }

    // 4. Resolve class_id from SEAT_CLASS
    const [classRows] = await pool.query(
      'SELECT class_id FROM SEAT_CLASS WHERE class_code = ?',
      [classType.toUpperCase()]
    );

    if (classRows.length === 0) {
      throw new AppError('VALIDATION_ERROR', `Invalid classType: ${classType}`, 400);
    }
    const classId = classRows[0].class_id;

    // 5. Ensure saved_passenger_id fallback
    let defaultSavedId = 7;
    const [savedPassRows] = await pool.query(
      'SELECT passenger_id FROM SAVED_PASSENGER WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (savedPassRows.length > 0) {
      defaultSavedId = savedPassRows[0].passenger_id;
    } else {
      const [anySaved] = await pool.query('SELECT passenger_id FROM SAVED_PASSENGER LIMIT 1');
      if (anySaved.length > 0) {
        defaultSavedId = anySaved[0].passenger_id;
      }
    }

    // 6. Format passengers array for JSON input to procedure
    const formattedPassengers = passengers.map(p => ({
      saved_passenger_id: p.saved_passenger_id || p.savedPassengerId || defaultSavedId,
      name: p.name,
      age: Number(p.age),
      gender: p.gender,
      concession_type: p.concession_type || p.concessionType || 'NONE',
      concession_proof_type: p.concession_proof_type || p.concessionProofType || p.idProofType || null,
      concession_proof_ref: p.concession_proof_ref || p.concessionProofRef || p.idProofReference || null,
      berth_preference: p.berth_preference || p.berthPreference || 'NO_BERTH'
    }));

    const fallbackConsent = continueWithGeneralQuota ? 1 : 0;
    const berthCondition = preferences.berthCondition ? 1 : 0;
    const p_hold_for_payment = 1;
    const p_manage_tx = 1;

    // 7. Invoke sp_create_booking
    const [callResult] = await pool.query(
      `CALL sp_create_booking(
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ONLINE', NULL, ?,
        @out_pnr, @out_status, @out_fare, @out_err
      );
      SELECT @out_pnr AS pnr, @out_status AS status, @out_fare AS total_fare, @out_err AS error_code;`,
      [
        userId,
        schedule.schedule_id,
        classId,
        fromStop.stop_id,
        toStop.stop_id,
        requestedQuota || quota,
        fallbackConsent,
        berthCondition,
        p_hold_for_payment,
        JSON.stringify(formattedPassengers),
        p_manage_tx
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

    if (!output) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to retrieve booking procedure output', 500);
    }

    if (output.error_code) {
      const errCode = output.error_code;
      const errMsg = CANONICAL_ERROR_MESSAGES[errCode] || `Booking failed with code: ${errCode}`;
      const statusCode = CANONICAL_ERROR_STATUS_CODES[errCode] || 400;
      throw new AppError(errCode, errMsg, statusCode);
    }

    const pnr = output.pnr;
    const projectedStatus = output.status;
    const totalFare = Number(output.total_fare);

    // 8. Fetch hold expiry time and seconds remaining (computed directly in MySQL via TIMESTAMPDIFF against NOW())
    const [bookingDetails] = await pool.query(
      `SELECT b.created_at,
              DATE_ADD(b.created_at, INTERVAL CAST(COALESCE(s.setting_value, '10') AS SIGNED) MINUTE) AS expires_at,
              GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(b.created_at, INTERVAL CAST(COALESCE(s.setting_value, '10') AS SIGNED) MINUTE))) AS seconds_remaining
       FROM BOOKING b
       LEFT JOIN SETTING s ON s.setting_key = 'HOLD_MINUTES'
       WHERE b.pnr = ?`,
      [pnr]
    );

    const expiresAtStr = bookingDetails[0] ? bookingDetails[0].expires_at : null;
    const secondsRemaining = bookingDetails[0] ? Number(bookingDetails[0].seconds_remaining) : 0;

    // 9. Fetch passenger fare breakdown
    const [fareBreakdown] = await pool.query(
      `SELECT passenger_no, name, base_fare, concession_discount, reservation_charge,
              superfast_charge, tatkal_charge, dynamic_surcharge, gst, insurance, total_fare
       FROM PASSENGER_BOOKING
       WHERE pnr = ?
       ORDER BY passenger_no ASC`,
      [pnr]
    );

    return res.status(201).json({
      success: true,
      data: {
        pnr,
        bookingStatus: 'PAYMENT_PENDING',
        projectedStatus,
        totalFare,
        fareBreakdown: fareBreakdown.map(f => ({
          passengerNo: f.passenger_no,
          name: f.name,
          baseFare: Number(f.base_fare),
          concessionDiscount: Number(f.concession_discount),
          reservationCharge: Number(f.reservation_charge),
          superfastCharge: Number(f.superfast_charge),
          tatkalCharge: Number(f.tatkal_charge),
          dynamicSurcharge: Number(f.dynamic_surcharge),
          gst: Number(f.gst),
          insurance: Number(f.insurance),
          totalFare: Number(f.total_fare)
        })),
        expiresAt: expiresAtStr,
        secondsRemaining
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookings/:pnr/hold
 * Returns hold expiry as string and secondsRemaining computed by MySQL (owner only).
 */
async function getBookingHold(req, res, next) {
  try {
    const userId = req.user.user_id || req.user.userId;
    const { pnr } = req.params;

    if (!pnr) {
      throw new AppError('VALIDATION_ERROR', 'PNR is required', 400);
    }

    const [rows] = await pool.query(
      `SELECT b.pnr, b.user_id, b.status, b.created_at,
              DATE_ADD(b.created_at, INTERVAL CAST(COALESCE(s.setting_value, '10') AS SIGNED) MINUTE) AS expires_at,
              GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(b.created_at, INTERVAL CAST(COALESCE(s.setting_value, '10') AS SIGNED) MINUTE))) AS seconds_remaining
       FROM BOOKING b
       LEFT JOIN SETTING s ON s.setting_key = 'HOLD_MINUTES'
       WHERE b.pnr = ?`,
      [pnr]
    );

    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const booking = rows[0];
    if (Number(booking.user_id) !== Number(userId)) {
      throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
    }

    return res.status(200).json({
      success: true,
      data: {
        pnr: booking.pnr,
        bookingStatus: booking.status,
        expiresAt: booking.expires_at,
        secondsRemaining: Number(booking.seconds_remaining)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4.5 Ticket Cancellation & Refund Estimation (Section 8)
 * POST /api/bookings/:pnr/cancel
 * Roles: PASSENGER (own PNR only), STAFF, ADMIN.
 */
async function cancelBooking(req, res, next) {
  let conn;
  try {
    const user = req.user;
    const userId = user.user_id || user.userId;
    const userRole = (user.role || '').toUpperCase();
    const { pnr } = req.params;
    const { passengerNos } = req.body || {};

    if (!pnr) {
      throw new AppError('VALIDATION_ERROR', 'PNR parameter is required', 400);
    }

    // 1. Fetch booking record
    const [bookingRows] = await pool.query(
      'SELECT pnr, user_id, schedule_id, class_id, status FROM BOOKING WHERE pnr = ?',
      [pnr]
    );

    if (bookingRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRows[0];

    // 2. Role authorization check: Passenger can only cancel their own booking
    if (userRole === 'PASSENGER' || (!userRole && userId)) {
      if (Number(booking.user_id) !== Number(userId)) {
        throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
      }
    } else if (userRole !== 'STAFF' && userRole !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Insufficient permissions to cancel booking', 403);
    }

    // 3. Status check: Refuse if not CONFIRMED (e.g. PAYMENT_PENDING, FAILED, CANCELLED)
    if (booking.status !== 'CONFIRMED') {
      throw new AppError(
        'BAD_REQUEST',
        `Cannot cancel booking with status '${booking.status}'. Only CONFIRMED bookings can be cancelled.`,
        400
      );
    }

    // 4. Validate passengers
    const [allPassengers] = await pool.query(
      `SELECT pb.passenger_no, pb.name, r.status AS reservation_status
       FROM PASSENGER_BOOKING pb
       JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
       WHERE pb.pnr = ?
       ORDER BY pb.passenger_no ASC`,
      [pnr]
    );

    if (allPassengers.length === 0) {
      throw new AppError('BAD_REQUEST', 'No passengers found on this booking', 400);
    }

    let targetPassengers = null;
    if (Array.isArray(passengerNos) && passengerNos.length > 0) {
      for (const pNo of passengerNos) {
        const found = allPassengers.find(p => Number(p.passenger_no) === Number(pNo));
        if (!found) {
          throw new AppError('BAD_REQUEST', `Passenger number ${pNo} does not belong to PNR ${pnr}`, 400);
        }
        if (found.reservation_status === 'CANCELLED') {
          throw new AppError('BAD_REQUEST', `Passenger number ${pNo} is already cancelled`, 400);
        }
      }
      targetPassengers = passengerNos.map(n => Number(n));
    } else {
      // Empty or omitted passengerNos cancels entire PNR
      const active = allPassengers.filter(p => p.reservation_status !== 'CANCELLED');
      if (active.length === 0) {
        throw new AppError('BAD_REQUEST', 'All passengers on this booking are already cancelled', 400);
      }
      targetPassengers = null; // procedure will be called with NULL
    }

    // 5. Begin single Node transaction with p_manage_tx = 0
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Snapshot schedule counts before cancellation for promotionTriggered detection
    const [beforeRows] = await conn.query(
      `SELECT 
         SUM(CASE WHEN status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS conf_count,
         SUM(CASE WHEN status = 'RAC' THEN 1 ELSE 0 END) AS rac_count
       FROM RESERVATION
       WHERE schedule_id = ? AND pnr != ?`,
      [booking.schedule_id, pnr]
    );
    const beforeConf = Number(beforeRows[0].conf_count || 0);
    const beforeRac = Number(beforeRows[0].rac_count || 0);

    // Call sp_cancel_passenger_ticket with p_manage_tx = 0
    const calls = targetPassengers === null ? [null] : targetPassengers;
    for (const pNo of calls) {
      const [resRows] = await conn.query(
        `CALL sp_cancel_passenger_ticket(?, ?, 'PASSENGER_REQUEST', 0, @out_charge, @out_refund, @out_status);
         SELECT @out_charge AS charge, @out_refund AS refund_amount, @out_status AS status;`,
        [pnr, pNo]
      );

      let output = null;
      if (Array.isArray(resRows)) {
        for (const r of resRows) {
          if (Array.isArray(r) && r.length > 0 && r[0].status !== undefined) {
            output = r[0];
            break;
          }
        }
      }

      if (!output) {
        throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to retrieve cancellation procedure output', 500);
      }

      if (output.status === 'CHART_PREPARED') {
        throw new AppError('CHART_PREPARED', CANONICAL_ERROR_MESSAGES.CHART_PREPARED, 400);
      }
      if (output.status === 'ALREADY_CANCELLED') {
        throw new AppError('BAD_REQUEST', 'Ticket or passenger is already cancelled', 400);
      }
      if (output.status === 'FAILED') {
        throw new AppError('INTERNAL_SERVER_ERROR', 'Cancellation procedure failed in database', 500);
      }
    }

    // Snapshot schedule counts after cancellation
    const [afterRows] = await conn.query(
      `SELECT 
         SUM(CASE WHEN status IN ('CONFIRMED', 'BOARDED') THEN 1 ELSE 0 END) AS conf_count,
         SUM(CASE WHEN status = 'RAC' THEN 1 ELSE 0 END) AS rac_count
       FROM RESERVATION
       WHERE schedule_id = ? AND pnr != ?`,
      [booking.schedule_id, pnr]
    );
    const afterConf = Number(afterRows[0].conf_count || 0);
    const afterRac = Number(afterRows[0].rac_count || 0);
    const promotionTriggered = (afterConf > beforeConf || afterRac > beforeRac);

    await conn.commit();
    conn.release();
    conn = null;

    // 6. Post-commit data retrieval
    // Determine the cancelled passenger numbers
    const cancelledPassengerNos = targetPassengers !== null
      ? targetPassengers
      : allPassengers.filter(p => p.reservation_status !== 'CANCELLED').map(p => Number(p.passenger_no));

    // Retrieve CANCELLATION rows for this PNR and passenger list
    const [cancelRows] = await pool.query(
      `SELECT cancel_id, passenger_no, charge, cancelled_at
       FROM CANCELLATION
       WHERE pnr = ? AND passenger_no IN (?)
       ORDER BY cancel_id ASC`,
      [pnr, cancelledPassengerNos]
    );

    const cancelIds = cancelRows.map(c => c.cancel_id);

    // Retrieve REFUND rows matching these cancel_ids
    let refundRows = [];
    if (cancelIds.length > 0) {
      const [rRows] = await pool.query(
        `SELECT refund_id, cancel_id, amount, reason, status
         FROM REFUND
         WHERE cancel_id IN (?)
         ORDER BY refund_id ASC`,
        [cancelIds]
      );
      refundRows = rRows;
    }

    const refundIds = refundRows.map(r => r.refund_id);
    const totalCancellationCharge = cancelRows.reduce((sum, c) => sum + Number(c.charge), 0);
    const totalRefundAmount = refundRows.reduce((sum, r) => sum + Number(r.amount), 0);

    // Work out hoursBeforeOriginDeparture via read-only SQL
    const [hoursRow] = await pool.query(
      `SELECT ROUND(TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(ts.journey_date, ts.departure_time)) / 60.0, 1) AS hours_left
       FROM BOOKING b
       JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
       WHERE b.pnr = ?`,
      [pnr]
    );
    const hoursBeforeOriginDeparture = hoursRow.length > 0 ? Number(hoursRow[0].hours_left) : 0;

    // Work out deductionPercentage via read-only SQL
    let deductionPercentage = 0;
    if (cancelIds.length > 0) {
      const [pctRow] = await pool.query(
        `SELECT 
           CASE 
             WHEN SUM(pb.total_fare - pb.insurance) > 0 
             THEN ROUND((SUM(c.charge) / SUM(pb.total_fare - pb.insurance)) * 100.0, 1)
             ELSE 0.0 
           END AS deduction_percentage
         FROM CANCELLATION c
         JOIN PASSENGER_BOOKING pb ON c.pnr = pb.pnr AND c.passenger_no = pb.passenger_no
         WHERE c.cancel_id IN (?)`,
        [cancelIds]
      );
      deductionPercentage = pctRow.length > 0 ? Number(pctRow[0].deduction_percentage) : 0;
    }

    // 7. Gateway refund for online payments
    let gatewayRefund = 'SKIPPED';
    if (totalRefundAmount > 0) {
      const [payRows] = await pool.query(
        `SELECT payment_id, method, gateway_payment_id, amount
         FROM PAYMENT
         WHERE pnr = ? AND status = 'SUCCESS'
         ORDER BY payment_id DESC
         LIMIT 1`,
        [pnr]
      );

      if (payRows.length > 0) {
        const payment = payRows[0];
        try {
          const gwRes = await processGatewayRefund({
            pnr,
            paymentMethod: payment.method,
            gatewayPaymentId: payment.gateway_payment_id,
            amountInRupees: totalRefundAmount,
            refundIds,
            reason: 'CANCELLATION'
          });
          gatewayRefund = gwRes.status; // 'SUCCESS', 'FAILED', or 'SKIPPED'
        } catch (gwErr) {
          console.error('[GATEWAY_REFUND_ERROR]:', gwErr.message);
          gatewayRefund = 'FAILED';
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        cancelId: cancelIds[0] || null,
        pnr,
        cancelledPassengers: cancelledPassengerNos,
        hoursBeforeOriginDeparture,
        deductionPercentage,
        cancellationCharge: Number(totalCancellationCharge.toFixed(2)),
        refundAmount: Number(totalRefundAmount.toFixed(2)),
        refund: refundRows[0] ? {
          refundId: refundRows[0].refund_id,
          reason: refundRows[0].reason,
          status: refundRows[0].status
        } : null,
        promotionTriggered,
        cancelIds,
        refundIds,
        gatewayRefund
      }
    });

  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {}
      conn.release();
    }
    next(error);
  }
}

/**
 * GET /api/bookings/:pnr/refund-estimate
 * Read-only refund estimate using fn_calculate_cancellation_refund.
 * Writes zero rows. No slab math in Node.
 * Roles: PASSENGER (own PNR only), STAFF, ADMIN.
 */
async function getRefundEstimate(req, res, next) {
  try {
    const user = req.user;
    const userId = user.user_id || user.userId;
    const userRole = (user.role || '').toUpperCase();
    const { pnr } = req.params;

    if (!pnr) {
      throw new AppError('VALIDATION_ERROR', 'PNR parameter is required', 400);
    }

    // 1. Fetch booking record
    const [bookingRows] = await pool.query(
      'SELECT pnr, user_id, schedule_id, class_id, status FROM BOOKING WHERE pnr = ?',
      [pnr]
    );

    if (bookingRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRows[0];

    // 2. Role authorization check: Passenger can only view their own booking
    if (userRole === 'PASSENGER' || (!userRole && userId)) {
      if (Number(booking.user_id) !== Number(userId)) {
        throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
      }
    } else if (userRole !== 'STAFF' && userRole !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Insufficient permissions to view refund estimate', 403);
    }

    // 3. Status check: Refuse if not CONFIRMED
    if (booking.status !== 'CONFIRMED') {
      throw new AppError(
        'BAD_REQUEST',
        `Cannot estimate refund for booking with status '${booking.status}'. Only CONFIRMED bookings can be cancelled.`,
        400
      );
    }

    // 4. Fetch all passengers
    const [allPassengers] = await pool.query(
      `SELECT pb.passenger_no, pb.name, pb.total_fare, pb.insurance, r.status AS reservation_status
       FROM PASSENGER_BOOKING pb
       JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
       WHERE pb.pnr = ?
       ORDER BY pb.passenger_no ASC`,
      [pnr]
    );

    if (allPassengers.length === 0) {
      throw new AppError('BAD_REQUEST', 'No passengers found on this booking', 400);
    }

    // Parse passengerNos from query parameter (e.g. ?passengerNos=1,2 or array)
    let requestedNos = null;
    if (req.query.passengerNos) {
      if (Array.isArray(req.query.passengerNos)) {
        requestedNos = req.query.passengerNos.map(Number);
      } else if (typeof req.query.passengerNos === 'string') {
        requestedNos = req.query.passengerNos.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      }
    }

    let targetPassengers = [];
    if (requestedNos && requestedNos.length > 0) {
      for (const pNo of requestedNos) {
        const found = allPassengers.find(p => Number(p.passenger_no) === Number(pNo));
        if (!found) {
          throw new AppError('BAD_REQUEST', `Passenger number ${pNo} does not belong to PNR ${pnr}`, 400);
        }
        if (found.reservation_status === 'CANCELLED') {
          throw new AppError('BAD_REQUEST', `Passenger number ${pNo} is already cancelled`, 400);
        }
        targetPassengers.push(found);
      }
    } else {
      // Active non-cancelled passengers
      targetPassengers = allPassengers.filter(p => p.reservation_status !== 'CANCELLED');
      if (targetPassengers.length === 0) {
        throw new AppError('BAD_REQUEST', 'All passengers on this booking are already cancelled', 400);
      }
    }

    // 5. Work out hoursBeforeOriginDeparture via read-only SQL
    const [hoursRow] = await pool.query(
      `SELECT ROUND(TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(ts.journey_date, ts.departure_time)) / 60.0, 1) AS hours_left
       FROM BOOKING b
       JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
       WHERE b.pnr = ?`,
      [pnr]
    );
    const hoursBeforeOriginDeparture = hoursRow.length > 0 ? Number(hoursRow[0].hours_left) : 0;

    // 6. Use database function fn_calculate_cancellation_refund for each passenger
    const passengerEstimates = [];
    let totalCancellationCharge = 0;
    let totalRefundAmount = 0;

    for (const p of targetPassengers) {
      const [fnResult] = await pool.query(
        'SELECT fn_calculate_cancellation_refund(?, ?, NULL) AS refund_json',
        [pnr, p.passenger_no]
      );
      let resJson = fnResult[0] ? fnResult[0].refund_json : null;
      if (typeof resJson === 'string') {
        try { resJson = JSON.parse(resJson); } catch (_) {}
      }
      const charge = resJson && resJson.charge !== undefined ? Number(resJson.charge) : 0;
      const refundAmount = resJson && resJson.refund_amount !== undefined ? Number(resJson.refund_amount) : 0;

      totalCancellationCharge += charge;
      totalRefundAmount += refundAmount;

      passengerEstimates.push({
        passengerNo: Number(p.passenger_no),
        name: p.name,
        reservationStatus: p.reservation_status,
        fare: Number(p.total_fare),
        charge: Number(charge.toFixed(2)),
        refundAmount: Number(refundAmount.toFixed(2))
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        pnr,
        hoursBeforeOriginDeparture,
        passengers: passengerEstimates,
        totalCancellationCharge: Number(totalCancellationCharge.toFixed(2)),
        totalRefundAmount: Number(totalRefundAmount.toFixed(2))
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Helper to format booking row according to API specification
 */
function formatBookingRow(row) {
  return {
    pnr: row.pnr,
    bookingStatus: row.bookingStatus,
    trainNumber: row.trainNumber,
    trainName: row.trainName,
    journeyDate: row.journeyDate,
    classType: row.classType,
    quota: row.quota,
    totalFare: Number(row.totalFare),
    passengerCount: Number(row.passengerCount),
    createdAt: row.createdAt,
    boardingStation: {
      stationCode: row.boardingStationCode,
      stationName: row.boardingStationName
    },
    destinationStation: {
      stationCode: row.destinationStationCode,
      stationName: row.destinationStationName
    }
  };
}

/**
 * 1. GET /api/bookings (my bookings list)
 * Passenger only, newest first, then pnr DESC, optional ?status= filter, limit default 50 capped at 200.
 */
async function getMyBookings(req, res, next) {
  try {
    const userRole = (req.user.role || '').toUpperCase();
    if (userRole !== 'PASSENGER') {
      throw new AppError('FORBIDDEN', 'Access denied: only passengers can view booking list', 403);
    }

    const userId = req.user.user_id || req.user.userId;
    const { status, limit } = req.query;

    const parsedLimit = parseInt(limit, 10);
    let limitVal = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    if (limitVal > 200) {
      limitVal = 200;
    }

    let query = `
      SELECT
        b.pnr,
        b.status AS bookingStatus,
        t.train_number AS trainNumber,
        t.display_name AS trainName,
        ts.journey_date AS journeyDate,
        sc.class_code AS classType,
        b.quota,
        b.total_fare AS totalFare,
        COUNT(pb.passenger_no) AS passengerCount,
        b.created_at AS createdAt,
        s_from.station_code AS boardingStationCode,
        s_from.station_name AS boardingStationName,
        s_to.station_code AS destinationStationCode,
        s_to.station_name AS destinationStationName
      FROM BOOKING b
      JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
      JOIN TRAIN t ON ts.train_id = t.train_id
      JOIN SEAT_CLASS sc ON b.class_id = sc.class_id
      JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
      JOIN STATION s_from ON rs_from.station_id = s_from.station_id
      JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
      JOIN STATION s_to ON rs_to.station_id = s_to.station_id
      LEFT JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      WHERE b.user_id = ?
    `;

    const params = [userId];

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    query += `
      GROUP BY
        b.pnr, b.status, t.train_number, t.display_name, ts.journey_date,
        sc.class_code, b.quota, b.total_fare, b.created_at,
        s_from.station_code, s_from.station_name, s_to.station_code, s_to.station_name
      ORDER BY b.created_at DESC, b.pnr DESC
      LIMIT ?
    `;
    params.push(limitVal);

    const [rows] = await pool.query(query, params);
    const bookings = rows.map(formatBookingRow);

    return res.status(200).json({
      success: true,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. GET /api/bookings/:pnr (PNR status)
 * Owner PASSENGER only; STAFF and ADMIN may read any PNR.
 */
async function getBookingByPnr(req, res, next) {
  try {
    const user = req.user;
    const userId = user.user_id || user.userId;
    const userRole = (user.role || '').toUpperCase();
    const { pnr } = req.params;

    if (!pnr) {
      throw new AppError('VALIDATION_ERROR', 'PNR parameter is required', 400);
    }

    const [bookingRows] = await pool.query(
      `SELECT
        b.pnr,
        b.user_id,
        b.status AS bookingStatus,
        t.train_number AS trainNumber,
        t.display_name AS trainName,
        ts.journey_date AS journeyDate,
        sc.class_code AS classType,
        b.quota,
        b.total_fare AS totalFare,
        COUNT(pb.passenger_no) AS passengerCount,
        b.created_at AS createdAt,
        s_from.station_code AS boardingStationCode,
        s_from.station_name AS boardingStationName,
        s_to.station_code AS destinationStationCode,
        s_to.station_name AS destinationStationName
      FROM BOOKING b
      JOIN TRAIN_SCHEDULE ts ON b.schedule_id = ts.schedule_id
      JOIN TRAIN t ON ts.train_id = t.train_id
      JOIN SEAT_CLASS sc ON b.class_id = sc.class_id
      JOIN ROUTE_STOP rs_from ON b.from_stop_id = rs_from.stop_id
      JOIN STATION s_from ON rs_from.station_id = s_from.station_id
      JOIN ROUTE_STOP rs_to ON b.to_stop_id = rs_to.stop_id
      JOIN STATION s_to ON rs_to.station_id = s_to.station_id
      LEFT JOIN PASSENGER_BOOKING pb ON b.pnr = pb.pnr
      WHERE b.pnr = ?
      GROUP BY
        b.pnr, b.user_id, b.status, t.train_number, t.display_name, ts.journey_date,
        sc.class_code, b.quota, b.total_fare, b.created_at,
        s_from.station_code, s_from.station_name, s_to.station_code, s_to.station_name`,
      [pnr]
    );

    if (bookingRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Booking not found', 404);
    }

    const bookingRow = bookingRows[0];

    // Authorization check: Owner PASSENGER only; STAFF and ADMIN may read any PNR
    if (userRole === 'PASSENGER' || (!userRole && userId)) {
      if (Number(bookingRow.user_id) !== Number(userId)) {
        throw new AppError('FORBIDDEN', 'Access denied: you do not own this booking', 403);
      }
    } else if (userRole !== 'STAFF' && userRole !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Insufficient permissions to view booking', 403);
    }

    // Plain joins across PASSENGER_BOOKING, RESERVATION, SEAT and COACH
    const [passengerRows] = await pool.query(
      `SELECT
        pb.passenger_no AS passengerNo,
        pb.name,
        pb.age,
        pb.gender,
        CASE WHEN b.status = 'CANCELLED' OR r.status = 'CANCELLED' THEN 'CANCELLED' ELSE r.status END AS status,
        CASE WHEN b.status = 'CANCELLED' OR r.status = 'CANCELLED' THEN NULL ELSE r.queue_position END AS queuePosition,
        CASE WHEN b.status = 'CANCELLED' OR r.status = 'CANCELLED' THEN NULL ELSE c.coach_code END AS coachNumber,
        CASE WHEN b.status = 'CANCELLED' OR r.status = 'CANCELLED' THEN NULL ELSE s.seat_number END AS seatNumber,
        CASE WHEN b.status = 'CANCELLED' OR r.status = 'CANCELLED' THEN NULL ELSE s.berth_type END AS berthType
      FROM PASSENGER_BOOKING pb
      JOIN BOOKING b ON pb.pnr = b.pnr
      JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
      LEFT JOIN SEAT s ON r.seat_id = s.seat_id
      LEFT JOIN COACH c ON s.coach_id = c.coach_id
      WHERE pb.pnr = ?
      ORDER BY pb.passenger_no ASC`,
      [pnr]
    );

    const passengers = passengerRows.map(p => ({
      passengerNo: Number(p.passengerNo),
      name: p.name,
      age: Number(p.age),
      gender: p.gender,
      status: p.status,
      queuePosition: p.queuePosition || null,
      coachNumber: p.coachNumber || null,
      seatNumber: p.seatNumber !== null && p.seatNumber !== undefined ? Number(p.seatNumber) : null,
      berthType: p.berthType || null
    }));

    const formattedBooking = formatBookingRow(bookingRow);

    return res.status(200).json({
      success: true,
      data: {
        ...formattedBooking,
        passengers
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBooking,
  getBookingHold,
  cancelBooking,
  getRefundEstimate,
  getMyBookings,
  getBookingByPnr
};

