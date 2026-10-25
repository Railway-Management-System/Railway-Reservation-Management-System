const pool = require('../config/mysql');
const { getMongoDb } = require('../config/mongodb');
const AppError = require('../utils/appError');
const { getBookingByPnr } = require('./bookingController');
const { createNotification } = require('../services/notificationService');
const { upsertLiveStatus } = require('../services/liveStatusService');

/**
 * Middleware: require STAFF role
 */
function requireStaffRole(req, res, next) {
  const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
  if (role !== 'STAFF') {
    return next(new AppError('FORBIDDEN', 'Access denied: staff only', 403));
  }
  if (!req.user.staffId) {
    return next(new AppError('FORBIDDEN', 'Staff ID not found on authenticated user', 403));
  }
  next();
}

/**
 * Middleware: require STAFF or ADMIN role
 */
function requireStaffOrAdminRole(req, res, next) {
  const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
  if (role !== 'STAFF' && role !== 'ADMIN') {
    return next(new AppError('FORBIDDEN', 'Access denied: staff or admin only', 403));
  }
  next();
}

/**
 * POST /api/staff/verification
 * Calls sp_verify_ticket with p_manage_tx = 1
 */
async function verifyTicket(req, res, next) {
  try {
    const staffId = req.user.staffId;
    const { pnr, passengerNo, idChecked, concessionChecked = false, result, remarks = null } = req.body;

    if (!pnr || passengerNo === undefined || result === undefined) {
      throw new AppError('VALIDATION_ERROR', 'pnr, passengerNo, and result are required', 400);
    }

    const pNo = parseInt(passengerNo, 10);
    if (isNaN(pNo)) {
      throw new AppError('VALIDATION_ERROR', 'passengerNo must be an integer', 400);
    }

    const idCheckVal = idChecked === true || idChecked === 1 ? 1 : 0;
    const concCheckVal = concessionChecked === true || concessionChecked === 1 ? 1 : 0;

    const [callResult] = await pool.query(
      `CALL sp_verify_ticket(?, ?, ?, ?, ?, ?, ?, 1, @out_verify_id, @out_status);
       SELECT @out_verify_id AS verify_id, @out_status AS status;`,
      [pnr, pNo, staffId, idCheckVal, concCheckVal, result, remarks]
    );

    let output = null;
    if (Array.isArray(callResult)) {
      for (const r of callResult) {
        if (Array.isArray(r) && r.length > 0 && r[0].status !== undefined) {
          output = r[0];
          break;
        }
      }
    }

    if (!output) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to retrieve verification output', 500);
    }

    if (output.status === 'VALIDATION_ERROR') {
      throw new AppError('VALIDATION_ERROR', 'idChecked must be true and result must be VALID, INVALID, or MISMATCH', 400);
    }
    if (output.status === 'NOT_FOUND') {
      throw new AppError('NOT_FOUND', 'Booking or passenger not found', 404);
    }
    if (output.status === 'NOT_ON_DUTY') {
      throw new AppError('FORBIDDEN', 'Staff member is not on duty for this train schedule', 403);
    }
    if (output.status === 'FAILED') {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Ticket verification procedure failed', 500);
    }

    return res.status(200).json({
      success: true,
      data: {
        verifyId: Number(output.verify_id),
        result
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/boarding
 * Calls sp_board_passenger with p_manage_tx = 1
 */
async function boardPassenger(req, res, next) {
  try {
    const staffId = req.user.staffId;
    const { pnr, passengerNo } = req.body;

    if (!pnr || passengerNo === undefined) {
      throw new AppError('VALIDATION_ERROR', 'pnr and passengerNo are required', 400);
    }

    const pNo = parseInt(passengerNo, 10);
    if (isNaN(pNo)) {
      throw new AppError('VALIDATION_ERROR', 'passengerNo must be an integer', 400);
    }

    const [callResult] = await pool.query(
      `CALL sp_board_passenger(?, ?, ?, 1, @out_status);
       SELECT @out_status AS status;`,
      [pnr, pNo, staffId]
    );

    let output = null;
    if (Array.isArray(callResult)) {
      for (const r of callResult) {
        if (Array.isArray(r) && r.length > 0 && r[0].status !== undefined) {
          output = r[0];
          break;
        }
      }
    }

    if (!output) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to retrieve boarding output', 500);
    }

    if (output.status === 'NOT_FOUND') {
      throw new AppError('NOT_FOUND', 'Booking or passenger not found', 404);
    }
    if (output.status === 'NOT_ON_DUTY') {
      throw new AppError('FORBIDDEN', 'Staff member is not on duty for this train schedule', 403);
    }
    if (output.status === 'NOT_ELIGIBLE') {
      throw new AppError('BAD_REQUEST', 'Only CONFIRMED or RAC passengers can be marked BOARDED (BR-ST4)', 400);
    }
    if (output.status === 'TDR_OPEN') {
      throw new AppError('BAD_REQUEST', 'Passenger has an open delay TDR (BR-ST4, BR-T6)', 400);
    }
    if (output.status === 'FAILED') {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Boarding procedure failed', 500);
    }

    return res.status(200).json({
      success: true,
      data: {
        pnr,
        passengerNo: pNo,
        status: 'BOARDED'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/no-show
 * Calls sp_mark_passenger_noshow with p_manage_tx = 1
 */
async function markNoShow(req, res, next) {
  try {
    const staffId = req.user.staffId;
    const { pnr, passengerNo } = req.body;

    if (!pnr || passengerNo === undefined) {
      throw new AppError('VALIDATION_ERROR', 'pnr and passengerNo are required', 400);
    }

    const pNo = parseInt(passengerNo, 10);
    if (isNaN(pNo)) {
      throw new AppError('VALIDATION_ERROR', 'passengerNo must be an integer', 400);
    }

    const [callResult] = await pool.query(
      `CALL sp_mark_passenger_noshow(?, ?, ?, 1, @out_status);
       SELECT @out_status AS status;`,
      [pnr, pNo, staffId]
    );

    let output = null;
    if (Array.isArray(callResult)) {
      for (const r of callResult) {
        if (Array.isArray(r) && r.length > 0 && r[0].status !== undefined) {
          output = r[0];
          break;
        }
      }
    }

    if (!output) {
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to retrieve no-show output', 500);
    }

    if (output.status === 'NOT_FOUND') {
      throw new AppError('NOT_FOUND', 'Booking or passenger not found', 404);
    }
    if (output.status === 'NOT_ON_DUTY') {
      throw new AppError('FORBIDDEN', 'Staff member is not on duty for this train schedule', 403);
    }
    if (output.status === 'NOT_ELIGIBLE') {
      throw new AppError('BAD_REQUEST', 'Only CONFIRMED or RAC passengers can be marked NO_SHOW (BR-ST4)', 400);
    }
    if (output.status === 'FAILED') {
      throw new AppError('INTERNAL_SERVER_ERROR', 'No-show procedure failed', 500);
    }

    return res.status(200).json({
      success: true,
      data: {
        pnr,
        passengerNo: pNo,
        status: 'NO_SHOW'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/staff/assignments/current
 * Returns active duty assignment now, otherwise the most recent one with isActive: false (Contract 5.1)
 */
async function getCurrentAssignment(req, res, next) {
  try {
    const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
    if (role !== 'STAFF') {
      return next(new AppError('FORBIDDEN', 'Access denied: staff only', 403));
    }

    let staffId = req.user.staffId;
    if (!staffId) {
      const [sRows] = await pool.query('SELECT staff_id FROM STAFF WHERE user_id = ?', [req.user.userId]);
      if (sRows.length > 0) {
        staffId = sRows[0].staff_id;
        req.user.staffId = staffId;
      }
    }
    if (!staffId) {
      return next(new AppError('FORBIDDEN', 'Staff ID not found on authenticated user', 403));
    }

    // 1. Query for assignment active right now
    const [activeRows] = await pool.query(
      `SELECT sa.assign_id, sa.staff_id, sa.schedule_id, sa.station_id, sa.duty_type,
              sa.shift_start, sa.shift_end,
              s.station_code, COALESCE(NULLIF(s.display_name, ''), s.station_name) AS station_name,
              ts.train_id, t.train_number, t.display_name AS train_name, ts.journey_date
       FROM STAFF_ASSIGNMENT sa
       LEFT JOIN STATION s ON sa.station_id = s.station_id
       LEFT JOIN TRAIN_SCHEDULE ts ON sa.schedule_id = ts.schedule_id
       LEFT JOIN TRAIN t ON ts.train_id = t.train_id
       WHERE sa.staff_id = ? AND NOW() BETWEEN sa.shift_start AND sa.shift_end
       ORDER BY sa.shift_end DESC
       LIMIT 1`,
      [staffId]
    );

    let row = null;
    let isActive = false;

    if (activeRows.length > 0) {
      row = activeRows[0];
      isActive = true;
    } else {
      // 2. Query for most recent assignment with isActive = false (since seed shifts are in the past)
      const [recentRows] = await pool.query(
        `SELECT sa.assign_id, sa.staff_id, sa.schedule_id, sa.station_id, sa.duty_type,
                sa.shift_start, sa.shift_end,
                s.station_code, COALESCE(NULLIF(s.display_name, ''), s.station_name) AS station_name,
                ts.train_id, t.train_number, t.display_name AS train_name, ts.journey_date
         FROM STAFF_ASSIGNMENT sa
         LEFT JOIN STATION s ON sa.station_id = s.station_id
         LEFT JOIN TRAIN_SCHEDULE ts ON sa.schedule_id = ts.schedule_id
         LEFT JOIN TRAIN t ON ts.train_id = t.train_id
         WHERE sa.staff_id = ?
         ORDER BY sa.shift_end DESC
         LIMIT 1`,
        [staffId]
      );

      if (recentRows.length > 0) {
        row = recentRows[0];
        isActive = false;
      }
    }

    if (!row) {
      return next(new AppError('NOT_FOUND', 'No duty assignment found for this staff member', 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        assignId: row.assign_id,
        staffId: row.staff_id,
        scheduleId: row.schedule_id,
        stationId: row.station_id,
        dutyType: row.duty_type,
        shiftStart: row.shift_start,
        shiftEnd: row.shift_end,
        isActive,
        station: row.station_code ? {
          stationId: row.station_id,
          stationCode: row.station_code,
          stationName: row.station_name
        } : null,
        schedule: row.schedule_id ? {
          scheduleId: row.schedule_id,
          trainId: row.train_id,
          trainNumber: row.train_number,
          trainName: row.train_name,
          journeyDate: String(row.journey_date)
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/staff/schedules/:scheduleId/chart
 * Returns CHART_SNAPSHOT rows for STAFF assigned to that run or ADMIN (Contract 5.1)
 * Refuses with error code BAD_REQUEST if chart is not prepared yet.
 */
async function getScheduleChart(req, res, next) {
  try {
    const role = (req.user && req.user.role ? req.user.role : '').toUpperCase();
    if (role !== 'STAFF' && role !== 'ADMIN') {
      return next(new AppError('FORBIDDEN', 'Access denied: staff or admin only', 403));
    }

    const schedId = parseInt(req.params.scheduleId, 10);
    if (isNaN(schedId) || schedId <= 0) {
      return next(new AppError('BAD_REQUEST', 'Valid numeric scheduleId required', 400));
    }

    // If STAFF, verify assignment to that train run
    if (role === 'STAFF') {
      let staffId = req.user.staffId;
      if (!staffId) {
        const [sRows] = await pool.query('SELECT staff_id FROM STAFF WHERE user_id = ?', [req.user.userId]);
        if (sRows.length > 0) {
          staffId = sRows[0].staff_id;
          req.user.staffId = staffId;
        }
      }
      if (!staffId) {
        return next(new AppError('FORBIDDEN', 'Staff ID not found on authenticated user', 403));
      }

      const [assignRows] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM STAFF_ASSIGNMENT WHERE staff_id = ? AND schedule_id = ?',
        [staffId, schedId]
      );
      if (assignRows[0].cnt === 0) {
        return next(new AppError('FORBIDDEN', 'Staff member is not assigned to this train schedule', 403));
      }
    }

    // Verify schedule exists and chart is prepared
    const [schedRows] = await pool.query(
      'SELECT schedule_id, chart_prepared_at FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
      [schedId]
    );

    if (schedRows.length === 0) {
      return next(new AppError('NOT_FOUND', 'Train schedule not found', 404));
    }

    if (!schedRows[0].chart_prepared_at) {
      return next(new AppError('BAD_REQUEST', 'Chart has not been prepared yet for this schedule', 400));
    }

    // Retrieve immutable CHART_SNAPSHOT records
    const [snapRows] = await pool.query(
      `SELECT cs.snapshot_id, cs.schedule_id, cs.pnr, cs.passenger_no,
              cs.coach_no, cs.seat_no, cs.berth_type, cs.status,
              cs.from_station_id, cs.to_station_id, cs.concession_flag, cs.generated_at,
              pb.name AS passenger_name,
              s_from.station_code AS from_station_code,
              s_to.station_code AS to_station_code
       FROM CHART_SNAPSHOT cs
       LEFT JOIN PASSENGER_BOOKING pb ON cs.pnr = pb.pnr AND cs.passenger_no = pb.passenger_no
       LEFT JOIN STATION s_from ON cs.from_station_id = s_from.station_id
       LEFT JOIN STATION s_to ON cs.to_station_id = s_to.station_id
       WHERE cs.schedule_id = ?
       ORDER BY cs.snapshot_id ASC`,
      [schedId]
    );

    const data = snapRows.map(r => ({
      snapshotId: r.snapshot_id,
      scheduleId: r.schedule_id,
      pnr: r.pnr,
      passengerNo: r.passenger_no,
      passengerName: r.passenger_name || null,
      coachNo: r.coach_no,
      seatNo: r.seat_no,
      berthType: r.berth_type,
      status: r.status,
      fromStationId: r.from_station_id,
      fromStationCode: r.from_station_code || null,
      toStationId: r.to_station_id,
      toStationCode: r.to_station_code || null,
      concessionFlag: Boolean(r.concession_flag),
      generatedAt: r.generated_at
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/fines (Contract 5.3, STAFF only)
 * - Reason must be a valid FINE ENUM: 'TICKETLESS_TRAVEL', 'UNAUTHORIZED_CLASS', 'SMOKING_NUISANCE', 'UNBOOKED_LUGGAGE'
 * - Amount must be > 0 (SETTING has no fine min or max keys, gap reported)
 * - payment_status: 'PAID' or 'UNPAID'
 * - passengerName, idProofReference, trainId required
 * - fine_id = MAX+1 inside a transaction
 */
async function issueFine(req, res, next) {
  let conn;
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff identity could not be verified' }
      });
    }

    const {
      passengerName,
      idProofReference,
      trainId,
      amount,
      reason,
      paymentStatus = 'UNPAID',
      verifyId = null
    } = req.body;

    if (!passengerName || typeof passengerName !== 'string' || !passengerName.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'passengerName is required' }
      });
    }

    if (!idProofReference || typeof idProofReference !== 'string' || !idProofReference.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'idProofReference is required' }
      });
    }

    if (!trainId || isNaN(Number(trainId))) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid trainId is required' }
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'amount must be a number greater than 0' }
      });
    }

    const validReasons = ['TICKETLESS_TRAVEL', 'UNAUTHORIZED_CLASS', 'SMOKING_NUISANCE', 'UNBOOKED_LUGGAGE'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` }
      });
    }

    const validStatuses = ['PAID', 'UNPAID'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: "Invalid paymentStatus. Must be 'PAID' or 'UNPAID'" }
      });
    }

    // Verify train exists
    const [trainRows] = await pool.query('SELECT train_id FROM TRAIN WHERE train_id = ?', [Number(trainId)]);
    if (trainRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Train not found' }
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(fine_id), 0) + 1 AS next_id FROM FINE FOR UPDATE');
    const fineId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO FINE (fine_id, verify_id, staff_id, passenger_name, id_proof_reference, train_id, amount, reason, payment_status, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        fineId,
        verifyId ? Number(verifyId) : null,
        staffId,
        passengerName.trim(),
        idProofReference.trim(),
        Number(trainId),
        numAmount,
        reason,
        paymentStatus
      ]
    );

    await conn.commit();

    const [createdRows] = await pool.query('SELECT issued_at FROM FINE WHERE fine_id = ?', [fineId]);

    return res.status(201).json({
      success: true,
      data: {
        fineId,
        verifyId: verifyId ? Number(verifyId) : null,
        staffId,
        passengerName: passengerName.trim(),
        idProofReference: idProofReference.trim(),
        trainId: Number(trainId),
        amount: numAmount,
        reason,
        paymentStatus,
        issuedAt: createdRows[0].issued_at
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * POST /api/staff/incidents (Contract 5.3, STAFF only)
 * - severity: LOW, MEDIUM, HIGH, CRITICAL
 * - staff member must be assigned to that schedule or station
 * - status starts REPORTED
 * - incident_id = MAX+1 inside a transaction
 */
async function reportIncident(req, res, next) {
  let conn;
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff identity could not be verified' }
      });
    }

    const { scheduleId, stationId, type, severity } = req.body;

    if (!type || typeof type !== 'string' || !type.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Incident type is required' }
      });
    }

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` }
      });
    }

    if (!scheduleId && !stationId) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'At least one of scheduleId or stationId must be provided' }
      });
    }

    // Check staff duty assignment on that schedule or station
    const [assignRows] = await pool.query(
      `SELECT assign_id FROM STAFF_ASSIGNMENT 
       WHERE staff_id = ? 
         AND ((? IS NOT NULL AND schedule_id = ?) OR (? IS NOT NULL AND station_id = ?))`,
      [staffId, scheduleId ? Number(scheduleId) : null, scheduleId ? Number(scheduleId) : null, stationId ? Number(stationId) : null, stationId ? Number(stationId) : null]
    );

    if (assignRows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff is not assigned to this schedule or station' }
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(incident_id), 0) + 1 AS next_id FROM INCIDENT FOR UPDATE');
    const incidentId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO INCIDENT (incident_id, staff_id, station_id, schedule_id, type, severity, status, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, 'REPORTED', NOW())`,
      [
        incidentId,
        staffId,
        stationId ? Number(stationId) : null,
        scheduleId ? Number(scheduleId) : null,
        type.trim(),
        severity
      ]
    );

    await conn.commit();

    const [createdRows] = await pool.query('SELECT reported_at FROM INCIDENT WHERE incident_id = ?', [incidentId]);

    // BR-ST9: A HIGH or CRITICAL incident immediately notifies all admins
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      try {
        const [adminUsers] = await pool.query("SELECT user_id FROM USER_ACCOUNT WHERE role = 'ADMIN'");
        for (const admin of adminUsers) {
          await createNotification({
            userId: Number(admin.user_id),
            type: 'EMERGENCY',
            title: `Emergency Incident (${severity})`,
            message: `Emergency incident #${incidentId}: ${type.trim()} reported (${severity})`,
            referenceId: String(incidentId)
          });
        }
      } catch (_) {}
    }

    await createNotification({
      userId: Number(req.user.user_id || req.user.userId),
      type: 'EMERGENCY',
      title: `Emergency Incident (${severity})`,
      message: `Emergency incident #${incidentId}: ${type.trim()} reported (${severity})`,
      referenceId: String(incidentId)
    });

    return res.status(201).json({
      success: true,
      data: {
        incidentId,
        staffId,
        scheduleId: scheduleId ? Number(scheduleId) : null,
        stationId: stationId ? Number(stationId) : null,
        type: type.trim(),
        severity,
        status: 'REPORTED',
        reportedAt: createdRows[0].reported_at
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * POST /api/staff/delays (Contract 5.4, STAFF only)
 * - TRAIN_DUTY staff on that schedule
 * - delayMinutes between 0 and 1,440
 * - updates TRAIN_SCHEDULE.delay_minutes
 */
async function logDelay(req, res, next) {
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff identity could not be verified' }
      });
    }

    const { scheduleId, delayMinutes } = req.body;

    if (!scheduleId || isNaN(Number(scheduleId))) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid scheduleId is required' }
      });
    }

    const mins = Number(delayMinutes);
    if (!Number.isInteger(mins) || mins < 0 || mins > 1440) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'delayMinutes must be an integer between 0 and 1440' }
      });
    }

    // Verify staff has TRAIN_DUTY assignment for that schedule
    const [assignRows] = await pool.query(
      'SELECT assign_id FROM STAFF_ASSIGNMENT WHERE staff_id = ? AND schedule_id = ? AND duty_type = "TRAIN_DUTY"',
      [staffId, Number(scheduleId)]
    );

    if (assignRows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff is not assigned on TRAIN_DUTY for this schedule' }
      });
    }

    // Check schedule exists
    const [schedRows] = await pool.query(
      'SELECT schedule_id, status FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
      [Number(scheduleId)]
    );

    if (schedRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Train schedule not found' }
      });
    }

    const currentStatus = schedRows[0].status;
    const newStatus = currentStatus === 'CANCELLED' ? 'CANCELLED' : (mins > 0 ? 'DELAYED' : 'ON_TIME');

    await pool.query(
      'UPDATE TRAIN_SCHEDULE SET delay_minutes = ?, status = ? WHERE schedule_id = ?',
      [mins, newStatus, Number(scheduleId)]
    );

    // Upsert live_train_status in MongoDB
    await upsertLiveStatus(scheduleId, { delayMinutes: mins, status: newStatus });

    // Notify passengers with confirmed or RAC bookings on that run
    try {
      const [passengerUsers] = await pool.query(
        `SELECT DISTINCT b.user_id
         FROM RESERVATION r
         JOIN BOOKING b ON r.pnr = b.pnr
         WHERE r.schedule_id = ? AND r.status IN ('CONFIRMED', 'RAC')`,
        [Number(scheduleId)]
      );
      for (const p of passengerUsers) {
        await createNotification({
          userId: Number(p.user_id),
          type: 'DELAY',
          title: 'Train Delay Update',
          message: `Train schedule ${scheduleId} is delayed by ${mins} minutes.`,
          referenceId: String(scheduleId)
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      data: {
        scheduleId: Number(scheduleId),
        delayMinutes: mins,
        status: newStatus
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/staff/crowd-reports (Contract 5.4, STAFF only)
 * - valid crowd level: LOW, MODERATE, HIGH, OVERCROWDED
 * - valid platform: platform_no belongs to station
 * - station from the staff member's assignment
 * - crowd_report_id = MAX+1 inside a transaction
 */
async function reportCrowd(req, res, next) {
  let conn;
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff identity could not be verified' }
      });
    }

    const { crowdLevel, platformNo, stationId: reqStationId, headCount = 0 } = req.body;

    const validLevels = ['LOW', 'MODERATE', 'HIGH', 'OVERCROWDED'];
    if (!validLevels.includes(crowdLevel)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid crowdLevel. Must be one of: ${validLevels.join(', ')}` }
      });
    }

    const platNo = Number(platformNo);
    if (!Number.isInteger(platNo) || platNo <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Valid positive platformNo is required' }
      });
    }

    // Determine station from staff assignment
    let stationId;
    if (reqStationId) {
      const [assignCheck] = await pool.query(
        'SELECT station_id FROM STAFF_ASSIGNMENT WHERE staff_id = ? AND station_id = ?',
        [staffId, Number(reqStationId)]
      );
      if (assignCheck.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Staff is not assigned to the requested station' }
        });
      }
      stationId = Number(reqStationId);
    } else {
      const [assignRows] = await pool.query(
        'SELECT station_id FROM STAFF_ASSIGNMENT WHERE staff_id = ? ORDER BY shift_end DESC LIMIT 1',
        [staffId]
      );
      if (assignRows.length === 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Staff has no station duty assignments' }
        });
      }
      stationId = assignRows[0].station_id;
    }

    // Validate platform exists for this station
    const [platRows] = await pool.query(
      'SELECT platform_id FROM PLATFORM WHERE station_id = ? AND platform_no = ?',
      [stationId, platNo]
    );
    if (platRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Platform ${platNo} does not exist at station ${stationId}` }
      });
    }

    const cnt = Math.max(0, Number(headCount) || 0);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(crowd_report_id), 0) + 1 AS next_id FROM CROWD_REPORT FOR UPDATE');
    const crowdReportId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO CROWD_REPORT (crowd_report_id, station_id, platform_no, crowd_level, head_count, staff_id, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [crowdReportId, stationId, platNo, crowdLevel, cnt, staffId]
    );

    await conn.commit();

    const [createdRows] = await pool.query('SELECT recorded_at FROM CROWD_REPORT WHERE crowd_report_id = ?', [crowdReportId]);

    return res.status(201).json({
      success: true,
      data: {
        crowdReportId,
        stationId,
        platformNo: platNo,
        crowdLevel,
        headCount: cnt,
        staffId,
        recordedAt: createdRows[0].recorded_at
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * POST /api/staff/cleanliness-reports (Contract 5.4, STAFF only)
 * - valid issue type: TOILET_DIRTY, LITTER, WATER_SHORTAGE, LINEN_SOILED, PESTS, SPILLAGE
 * - description required
 * - trainId, coachId, stationId, platformNo optional
 * - cleanliness_report_id = MAX+1 inside a transaction
 */
async function reportCleanliness(req, res, next) {
  let conn;
  try {
    const staffId = req.user.staffId;
    if (!staffId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff identity could not be verified' }
      });
    }

    const {
      issueType,
      description,
      trainId = null,
      coachId = null,
      stationId = null,
      platformNo = null
    } = req.body;

    const validIssues = ['TOILET_DIRTY', 'LITTER', 'WATER_SHORTAGE', 'LINEN_SOILED', 'PESTS', 'SPILLAGE'];
    if (!validIssues.includes(issueType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid issueType. Must be one of: ${validIssues.join(', ')}` }
      });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'description is required' }
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(cleanliness_report_id), 0) + 1 AS next_id FROM CLEANLINESS_REPORT FOR UPDATE');
    const cleanlinessReportId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO CLEANLINESS_REPORT (cleanliness_report_id, staff_id, train_id, coach_id, station_id, platform_no, issue_type, description, status, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REPORTED', NOW())`,
      [
        cleanlinessReportId,
        staffId,
        trainId ? Number(trainId) : null,
        coachId ? Number(coachId) : null,
        stationId ? Number(stationId) : null,
        platformNo ? Number(platformNo) : null,
        issueType,
        description.trim()
      ]
    );

    await conn.commit();

    const [createdRows] = await pool.query('SELECT recorded_at FROM CLEANLINESS_REPORT WHERE cleanliness_report_id = ?', [cleanlinessReportId]);

    return res.status(201).json({
      success: true,
      data: {
        cleanlinessReportId,
        staffId,
        trainId: trainId ? Number(trainId) : null,
        coachId: coachId ? Number(coachId) : null,
        stationId: stationId ? Number(stationId) : null,
        platformNo: platformNo ? Number(platformNo) : null,
        issueType,
        description: description.trim(),
        status: 'REPORTED',
        recordedAt: createdRows[0].recorded_at
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  requireStaffRole,
  requireStaffOrAdminRole,
  verifyTicket,
  boardPassenger,
  markNoShow,
  getBookingByPnr,
  getCurrentAssignment,
  getScheduleChart,
  issueFine,
  reportIncident,
  logDelay,
  reportCrowd,
  reportCleanliness
};
