const pool = require('../config/mysql');
const AppError = require('../utils/appError');
const { CANONICAL_ERROR_MESSAGES, CANONICAL_ERROR_STATUS_CODES } = require('../middleware/errorHandler');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityLogService');

/**
 * 4.4 Station Counter Booking API
 * POST /api/counter/bookings
 * Role: STAFF only, calls sp_create_counter_booking with p_manage_tx = 1
 */
async function createCounterBooking(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'STAFF') {
      throw new AppError('FORBIDDEN', 'Access denied: Station counter booking requires STAFF role.', 403);
    }

    // Look up staff_id
    let staffId = req.user.staffId;
    if (!staffId) {
      const [staffRows] = await pool.query('SELECT staff_id FROM STAFF WHERE user_id = ?', [req.user.user_id]);
      if (staffRows.length === 0) {
        throw new AppError('FORBIDDEN', 'Staff profile not found for this user account.', 403);
      }
      staffId = staffRows[0].staff_id;
    }

    const {
      trainId,
      journeyDate,
      boardingStationId,
      destinationStationId,
      classType,
      quota = 'GENERAL',
      isWalkin = true,
      registeredUserId = null,
      passengers,
      payment = {}
    } = req.body;

    if (!trainId || !journeyDate || !boardingStationId || !destinationStationId || !classType) {
      throw new AppError('VALIDATION_ERROR', 'trainId, journeyDate, boardingStationId, destinationStationId, and classType are required', 400);
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one passenger is required', 400);
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

    // 2. Resolve origin departure date
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
      throw new AppError('TRAIN_NOT_RUNNING', 'The train does not operate on the origin departure date corresponding to the boarding date', 400);
    }

    const schedule = scheduleRows[0];
    if (schedule.chart_prepared_at) {
      throw new AppError('CHART_PREPARED', 'Counter booking attempted at or after chart preparation time.', 400);
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

    // 5. Saved passenger ID fallback
    const targetUserId = (!isWalkin && registeredUserId) ? registeredUserId : 50008;
    let defaultSavedId = 7;
    const [savedPassRows] = await pool.query(
      'SELECT passenger_id FROM SAVED_PASSENGER WHERE user_id = ? LIMIT 1',
      [targetUserId]
    );
    if (savedPassRows.length > 0) {
      defaultSavedId = savedPassRows[0].passenger_id;
    } else {
      const [anySaved] = await pool.query('SELECT passenger_id FROM SAVED_PASSENGER LIMIT 1');
      if (anySaved.length > 0) {
        defaultSavedId = anySaved[0].passenger_id;
      }
    }

    // 6. Format passengers array
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

    const paymentMethod = (payment && payment.method) ? payment.method.toUpperCase() : 'CASH';
    const p_manage_tx = 1;

    // 7. Invoke sp_create_counter_booking with p_manage_tx = 1
    const [callResult] = await pool.query(
      `CALL sp_create_counter_booking(
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        @out_pnr, @out_total_fare, @out_status, @out_error_code
      );
      SELECT @out_pnr AS pnr, @out_total_fare AS total_fare, @out_status AS status, @out_error_code AS error_code;`,
      [
        staffId,
        targetUserId,
        schedule.schedule_id,
        classId,
        fromStop.stop_id,
        toStop.stop_id,
        quota,
        JSON.stringify(formattedPassengers),
        paymentMethod,
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
      throw new AppError('INTERNAL_SERVER_ERROR', 'Failed to execute counter booking procedure', 500);
    }

    if (output.error_code) {
      const errCode = output.error_code;
      const errMsg = CANONICAL_ERROR_MESSAGES[errCode] || `Counter booking failed with code: ${errCode}`;
      const statusCode = CANONICAL_ERROR_STATUS_CODES[errCode] || 400;
      throw new AppError(errCode, errMsg, statusCode);
    }

    const pnr = output.pnr;
    const totalFare = Number(output.total_fare);
    const bookingStatus = output.status;

    // 8. Retrieve passenger reservations
    const [passengersList] = await pool.query(
      `SELECT pb.passenger_no, pb.name,
              c.coach_code AS coachNumber,
              s.seat_number AS seatNumber,
              s.berth_type AS berthType,
              r.status, r.queue_position
       FROM PASSENGER_BOOKING pb
       JOIN RESERVATION r ON pb.pnr = r.pnr AND pb.passenger_no = r.passenger_no
       LEFT JOIN SEAT s ON r.seat_id = s.seat_id
       LEFT JOIN COACH c ON s.coach_id = c.coach_id
       WHERE pb.pnr = ?
       ORDER BY pb.passenger_no ASC`,
      [pnr]
    );

    // Station codes for ticket text
    const [stnRows] = await pool.query(
      'SELECT station_id, station_code FROM STATION WHERE station_id IN (?, ?)',
      [boardingStationId, destinationStationId]
    );
    const srcStn = stnRows.find(s => Number(s.station_id) === Number(boardingStationId));
    const destStn = stnRows.find(s => Number(s.station_id) === Number(destinationStationId));
    const srcCode = srcStn ? srcStn.station_code : String(boardingStationId);
    const destCode = destStn ? destStn.station_code : String(destinationStationId);

    const firstPass = passengersList[0] || {};
    const printableTicketText = `INDIAN RAILWAYS / PNR: ${pnr} / ${srcCode} -> ${destCode} / COACH: ${firstPass.coachNumber || 'WL'} SEAT: ${firstPass.seatNumber || 'WL'} (${firstPass.berthType || 'NONE'}) / FARE: Rs ${totalFare.toFixed(2)} (${paymentMethod} PAID)`;

    createNotification({
      userId: Number(targetUserId),
      type: 'BOOKING_CONFIRMATION',
      title: 'Booking Confirmed',
      message: `Your booking for PNR ${pnr} is ${bookingStatus}.`,
      referenceId: String(pnr)
    });

    logActivity({
      userId: Number(req.user.user_id || req.user.userId),
      action: 'BOOKING',
      tableName: 'BOOKING',
      recordId: String(pnr),
      newValue: {
        pnr: String(pnr),
        channel: 'COUNTER',
        status: bookingStatus
      }
    });

    logActivity({
      userId: Number(req.user.user_id || req.user.userId),
      action: 'PAYMENT',
      tableName: 'PAYMENT',
      recordId: String(pnr),
      newValue: {
        pnr: String(pnr),
        amount: totalFare,
        method: paymentMethod
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        pnr,
        channel: 'COUNTER',
        bookedByStaffId: staffId,
        userAccount: isWalkin ? 'COUNTER_WALKIN' : String(targetUserId),
        bookingStatus,
        totalFare,
        payment: {
          method: paymentMethod,
          status: 'SUCCESS'
        },
        passengers: passengersList.map(p => {
          const item = {
            passengerNo: p.passenger_no,
            name: p.name,
            coachNumber: p.coachNumber || null,
            seatNumber: p.seatNumber || null,
            berthType: p.berthType || null,
            status: p.status
          };
          if (p.queue_position) {
            item.queuePosition = p.queue_position;
          }
          return item;
        }),
        printableTicketText
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCounterBooking
};
