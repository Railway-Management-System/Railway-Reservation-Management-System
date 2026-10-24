const pool = require('../config/mysql');
const AppError = require('../utils/appError');

// Validate YYYY-MM-DD format strictly without JS Date
function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 2020 || year > 2040) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

// Format MySQL TIME or HH:MM:SS to HH:MM
function formatTime(timeVal) {
  if (!timeVal) return '00:00';
  const str = String(timeVal);
  const parts = str.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
}

// Format duration minutes to "Xh Ym"
function formatDuration(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * 3.1 Search Trains with Running-Day Check (BR-B1, BR-B1a)
 * GET /api/trains/search
 */
async function searchTrains(req, res, next) {
  try {
    const { sourceStationId, destinationStationId, journeyDate, classType, quota = 'GENERAL' } = req.query;

    if (!sourceStationId || !destinationStationId || !journeyDate) {
      throw new AppError('VALIDATION_ERROR', 'sourceStationId, destinationStationId, and journeyDate are required', 400);
    }

    if (!isValidDateString(journeyDate)) {
      throw new AppError('VALIDATION_ERROR', 'journeyDate must be in valid YYYY-MM-DD format', 400);
    }

    // Resolve source and destination stations
    const [stationRows] = await pool.query(
      'SELECT station_id, station_code, station_name, display_name FROM STATION WHERE station_id IN (?, ?) OR station_code IN (?, ?)',
      [sourceStationId, destinationStationId, sourceStationId, destinationStationId]
    );

    const srcStation = stationRows.find(s => String(s.station_id) === String(sourceStationId) || s.station_code === String(sourceStationId).toUpperCase());
    const destStation = stationRows.find(s => String(s.station_id) === String(destinationStationId) || s.station_code === String(destinationStationId).toUpperCase());

    if (!srcStation || !destStation) {
      throw new AppError('VALIDATION_ERROR', 'Specified source or destination station not found', 404);
    }

    if (srcStation.station_id === destStation.station_id) {
      throw new AppError('VALIDATION_ERROR', 'Source and destination stations cannot be the same', 400);
    }

    // Find trains that connect source and destination in correct sequence
    // Uses vw_train_master_schedule per requirement
    const [candidateTrains] = await pool.query(
      `SELECT
        t.train_id,
        t.train_number,
        t.short_name,
        t.display_name,
        t.train_type,
        t.running_days,
        s_src.stop_sequence as src_seq,
        s_src.departure_time as src_dep_time,
        s_src.day_offset as src_day_offset,
        s_src.distance_from_origin as src_distance,
        s_src.platform_number as src_platform,
        s_dest.stop_sequence as dest_seq,
        s_dest.arrival_time as dest_arr_time,
        s_dest.day_offset as dest_day_offset,
        s_dest.distance_from_origin as dest_distance,
        s_dest.platform_number as dest_platform,
        (s_dest.distance_from_origin - s_src.distance_from_origin) as distance_km,
        DATE_SUB(?, INTERVAL s_src.day_offset DAY) as origin_date,
        DATE_ADD(DATE_SUB(?, INTERVAL s_src.day_offset DAY), INTERVAL s_dest.day_offset DAY) as arrival_date,
        UPPER(SUBSTRING(DAYNAME(DATE_SUB(?, INTERVAL s_src.day_offset DAY)), 1, 3)) as origin_weekday
      FROM vw_train_master_schedule s_src
      JOIN vw_train_master_schedule s_dest ON s_src.train_id = s_dest.train_id
      JOIN TRAIN t ON s_src.train_id = t.train_id
      WHERE s_src.station_code = ?
        AND s_dest.station_code = ?
        AND s_dest.stop_sequence > s_src.stop_sequence
        AND t.status = 'ACTIVE'
      ORDER BY s_src.departure_time ASC`,
      [journeyDate, journeyDate, journeyDate, srcStation.station_code, destStation.station_code]
    );

    const results = [];

    for (const tr of candidateTrains) {
      // 1. Check running days (BR-B1a):
      let runningDaysList = tr.running_days;
      if (typeof runningDaysList === 'string') {
        try { runningDaysList = JSON.parse(runningDaysList); } catch (e) { runningDaysList = []; }
      }

      if (!Array.isArray(runningDaysList) || !runningDaysList.includes(tr.origin_weekday)) {
        // Train does not operate on that origin date's weekday: omitted per BR-B1a
        continue;
      }

      // 2. Fetch train schedule for that run
      const [scheduleRows] = await pool.query(
        'SELECT schedule_id, status as schedule_status, delay_minutes, chart_prepared_at FROM TRAIN_SCHEDULE WHERE train_id = ? AND journey_date = ?',
        [tr.train_id, tr.origin_date]
      );

      if (scheduleRows.length === 0) {
        continue;
      }

      const schedule = scheduleRows[0];
      if (schedule.schedule_status === 'CANCELLED') {
        continue;
      }

      // 3. Fetch seat availability per run and class from vw_available_seats_per_run
      let classQuery = `
        SELECT
          class_code,
          class_name,
          total_seats,
          available_seats,
          rac_capacity,
          rac_count,
          wl_capacity,
          wl_count
        FROM vw_available_seats_per_run
        WHERE schedule_id = ?
      `;
      const classParams = [schedule.schedule_id];

      if (classType) {
        classQuery += ' AND class_code = ?';
        classParams.push(classType.toUpperCase());
      }

      classQuery += ' ORDER BY class_code ASC';

      const [availableClassRows] = await pool.query(classQuery, classParams);

      const availableClasses = [];

      // Calculate fare for each class
      for (const cls of availableClassRows) {
        // Get class_id for fare function
        const [scRows] = await pool.query('SELECT class_id FROM SEAT_CLASS WHERE class_code = ?', [cls.class_code]);
        const classId = scRows.length > 0 ? scRows[0].class_id : 1;

        let fareDetails = {
          base_fare: 0,
          superfast_charge: 0,
          reservation_charge: 0,
          gst: 0,
          total_fare: 0
        };

        try {
          const [fareRes] = await pool.query(
            'SELECT fn_calculate_fare(?, ?, ?, ?, ?, 1, ?) as fare',
            [classId, tr.train_id, tr.distance_km, quota.toUpperCase(), 'NONE', schedule.schedule_id]
          );
          if (fareRes && fareRes[0] && fareRes[0].fare) {
            fareDetails = typeof fareRes[0].fare === 'string'
              ? JSON.parse(fareRes[0].fare)
              : fareRes[0].fare;
          }
        } catch (fareErr) {
          // Fallback if fare function has exception
        }

        availableClasses.push({
          classType: cls.class_code,
          availableSeats: Number(cls.available_seats),
          racCount: Number(cls.rac_count),
          waitingListCount: Number(cls.wl_count),
          baseFare: parseFloat(fareDetails.base_fare || 0),
          superfastCharge: parseFloat(fareDetails.superfast_charge || 0),
          reservationCharge: parseFloat(fareDetails.reservation_charge || 0),
          gst: parseFloat(fareDetails.gst || 0),
          estimatedTotalFare: parseFloat(fareDetails.total_fare || 0)
        });
      }

      // Calculate journey duration in minutes via SQL timestamp diff
      const [diffRows] = await pool.query(
        'SELECT TIMESTAMPDIFF(MINUTE, TIMESTAMP(?, ?), TIMESTAMP(?, ?)) as diff_min',
        [journeyDate, tr.src_dep_time, tr.arrival_date, tr.dest_arr_time]
      );
      const durationMin = diffRows[0].diff_min || 0;

      results.push({
        trainId: tr.train_id,
        trainNumber: tr.train_number,
        shortName: tr.short_name,
        displayName: tr.display_name,
        trainType: tr.train_type,
        boardingStation: {
          stationId: srcStation.station_id,
          stationCode: srcStation.station_code,
          stationName: srcStation.display_name || srcStation.station_name,
          departureTime: formatTime(tr.src_dep_time),
          boardingDate: journeyDate,
          dayOffset: tr.src_day_offset
        },
        destinationStation: {
          stationId: destStation.station_id,
          stationCode: destStation.station_code,
          stationName: destStation.display_name || destStation.station_name,
          arrivalTime: formatTime(tr.dest_arr_time),
          arrivalDate: tr.arrival_date,
          dayOffset: tr.dest_day_offset
        },
        originDate: tr.origin_date,
        duration: formatDuration(durationMin),
        distanceKm: Number(tr.distance_km),
        runningDays: runningDaysList,
        availableClasses
      });
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3.2 Get Train Route & Timetable
 * GET /api/trains/:trainId
 */
async function getTrainById(req, res, next) {
  try {
    const { trainId } = req.params;

    const [trainRows] = await pool.query(
      `SELECT train_id, train_number, short_name, display_name, train_type,
              source_station_id, destination_station_id, running_days, status
       FROM TRAIN
       WHERE train_id = ? OR train_number = ?`,
      [trainId, trainId]
    );

    if (trainRows.length === 0) {
      throw new AppError('NOT_FOUND', `Train with identifier '${trainId}' not found`, 404);
    }

    const train = trainRows[0];
    let runningDaysList = train.running_days;
    if (typeof runningDaysList === 'string') {
      try { runningDaysList = JSON.parse(runningDaysList); } catch (e) { runningDaysList = []; }
    }

    // Fetch timetable stops using vw_train_master_schedule joined with ROUTE_STOP and STATION
    const [stops] = await pool.query(
      `SELECT
        rs.stop_id,
        s.station_id,
        s.station_code,
        s.display_name as station_name,
        v.stop_sequence,
        v.arrival_time,
        v.departure_time,
        v.day_offset,
        v.distance_from_origin as distance_from_origin_km,
        v.platform_number as platform_no
      FROM vw_train_master_schedule v
      JOIN ROUTE_STOP rs ON rs.train_id = v.train_id AND rs.stop_sequence = v.stop_sequence
      JOIN STATION s ON rs.station_id = s.station_id
      WHERE v.train_id = ?
      ORDER BY v.stop_sequence ASC`,
      [train.train_id]
    );

    const formattedRoute = stops.map(stop => ({
      stopId: stop.stop_id,
      stationId: stop.station_id,
      stationCode: stop.station_code,
      stationName: stop.station_name,
      stopSequence: stop.stop_sequence,
      arrivalTime: formatTime(stop.arrival_time),
      departureTime: formatTime(stop.departure_time),
      dayOffset: stop.day_offset,
      distanceFromOriginKm: stop.distance_from_origin_km,
      platformNo: stop.platform_no
    }));

    return res.status(200).json({
      success: true,
      data: {
        trainId: train.train_id,
        trainNumber: train.train_number,
        shortName: train.short_name,
        displayName: train.display_name,
        trainType: train.train_type,
        sourceStationId: train.source_station_id,
        destinationStationId: train.destination_station_id,
        runningDays: runningDaysList,
        route: formattedRoute
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3.3 Quota Availability & Fallback Advisory (BR-Q13)
 * GET /api/trains/:trainId/availability
 */
async function getTrainAvailability(req, res, next) {
  try {
    const { trainId } = req.params;
    const { journeyDate, classType, quota = 'GENERAL', passengerCount = 1 } = req.query;

    if (!journeyDate || !classType) {
      throw new AppError('VALIDATION_ERROR', 'journeyDate and classType query parameters are required', 400);
    }

    if (!isValidDateString(journeyDate)) {
      throw new AppError('VALIDATION_ERROR', 'journeyDate must be in valid YYYY-MM-DD format', 400);
    }

    const requestedClass = classType.toUpperCase();
    const requestedQuota = quota.toUpperCase();
    const count = parseInt(passengerCount, 10) || 1;

    // Resolve train
    const [trainRows] = await pool.query(
      'SELECT train_id, train_number, display_name, running_days FROM TRAIN WHERE train_id = ? OR train_number = ?',
      [trainId, trainId]
    );

    if (trainRows.length === 0) {
      throw new AppError('NOT_FOUND', `Train '${trainId}' not found`, 404);
    }

    const train = trainRows[0];

    // Check train runs for origin date matching journeyDate
    // Query schedule and class inventory from vw_available_seats_per_run
    const [availRows] = await pool.query(
      `SELECT
        schedule_id,
        train_id,
        journey_date,
        class_code,
        class_name,
        total_seats,
        available_seats,
        rac_capacity,
        rac_count,
        wl_capacity,
        wl_count
      FROM vw_available_seats_per_run
      WHERE (train_id = ? OR train_number = ?)
        AND journey_date = ?
        AND class_code = ?`,
      [train.train_id, train.train_number, journeyDate, requestedClass]
    );

    if (availRows.length === 0) {
      throw new AppError('NOT_FOUND', `No schedule inventory found for train ${train.train_number} on ${journeyDate} in class ${requestedClass}`, 404);
    }

    const inventory = availRows[0];

    // Handle Fallback Quota per BR-Q13:
    // If LADIES, SENIOR_CITIZEN, or DIVYAANG has no seats for the whole group:
    if (['LADIES', 'SENIOR_CITIZEN', 'DIVYAANG'].includes(requestedQuota)) {
      // Calculate quota capacity
      const totalSeats = inventory.total_seats;
      let quotaCap = 0;
      if (requestedQuota === 'LADIES') {
        quotaCap = Math.round(totalSeats * 0.10);
      } else if (requestedQuota === 'SENIOR_CITIZEN') {
        const [coachCount] = await pool.query(
          'SELECT COUNT(*) as c FROM COACH c JOIN SEAT_CLASS sc ON c.class_id = sc.class_id WHERE c.train_id = ? AND sc.class_code = ?',
          [train.train_id, requestedClass]
        );
        const coaches = coachCount[0].c || 0;
        if (requestedClass === 'SL') quotaCap = 6 * coaches;
        else if (requestedClass === '3A') quotaCap = 4 * coaches;
        else if (requestedClass === '2A') quotaCap = 3 * coaches;
      } else if (requestedQuota === 'DIVYAANG') {
        if (['SL', '3A', 'CC', '2S'].includes(requestedClass)) quotaCap = 4;
      }

      // Count booked seats in this quota
      const [bookedRows] = await pool.query(
        `SELECT COUNT(r.res_id) as booked
         FROM BOOKING b
         JOIN RESERVATION r ON b.pnr = r.pnr
         WHERE b.schedule_id = ? AND b.quota = ? AND r.status IN ('CONFIRMED', 'BOARDED')`,
        [inventory.schedule_id, requestedQuota]
      );
      const booked = bookedRows[0].booked || 0;
      const quotaAvailable = Math.max(0, Math.min(quotaCap - booked, inventory.available_seats));

      if (quotaAvailable < count) {
        // Fallback triggered per BR-Q13
        const generalAvail = inventory.available_seats;
        let projectedStatus = 'WAITING_LIST';
        if (generalAvail >= count) {
          projectedStatus = 'CONFIRMED';
        } else if ((inventory.rac_capacity - inventory.rac_count) >= count) {
          projectedStatus = 'RAC';
        }

        return res.status(200).json({
          success: true,
          data: {
            trainId: train.train_id,
            journeyDate: journeyDate,
            classType: requestedClass,
            requestedQuota: requestedQuota,
            availableSeats: quotaAvailable,
            fallbackOffered: true,
            fallbackNotice: `No seats are left in the ${requestedQuota} quota for this train and date. We can book you in the General quota instead. Your seat may not be your preferred one (for example an upper berth or a different coach), and General seats go first-come-first-served, so you may get RAC or Waiting List instead of a confirmed seat. Fare, refund and cancellation rules stay the same.`,
            generalQuotaStatus: {
              availableSeats: generalAvail,
              projectedStatus
            }
          }
        });
      }
    }

    // Direct Availability (GENERAL, TATKAL, or satisfied quota)
    return res.status(200).json({
      success: true,
      data: {
        trainId: train.train_id,
        journeyDate: journeyDate,
        classType: requestedClass,
        quota: requestedQuota,
        availableSeats: Number(inventory.available_seats),
        racCount: Number(inventory.rac_count),
        waitingListCount: Number(inventory.wl_count),
        fallbackOffered: false
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchTrains,
  getTrainById,
  getTrainAvailability
};
