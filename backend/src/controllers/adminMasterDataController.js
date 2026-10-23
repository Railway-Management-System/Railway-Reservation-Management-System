const pool = require('../config/mysql');
const AppError = require('../utils/appError');

// Helper to convert DB snake_case to frontend camelCase
function mapStation(r) {
  return {
    stationId: r.station_id,
    stationCode: r.station_code,
    stationName: r.station_name,
    displayName: r.display_name,
    city: r.city,
    state: r.state,
    platformCount: r.platform_count
  };
}

function mapTrain(r) {
  let runningDays = r.running_days;
  if (typeof runningDays === 'string') {
    try {
      runningDays = JSON.parse(runningDays);
    } catch (_) {}
  }
  return {
    trainId: r.train_id,
    trainNumber: r.train_number,
    shortName: r.short_name,
    displayName: r.display_name,
    trainType: r.train_type,
    sourceStationId: r.source_station_id,
    destinationStationId: r.destination_station_id,
    runningDays,
    status: r.status
  };
}

function mapRouteStop(r) {
  return {
    stopId: r.stop_id,
    trainId: r.train_id,
    stationId: r.station_id,
    stopSequence: r.stop_sequence,
    arrivalTime: r.arrival_time,
    departureTime: r.departure_time,
    dayOffset: r.day_offset,
    distanceFromOrigin: r.distance_from_origin,
    platformNumber: r.platform_number
  };
}

function mapCoach(r) {
  return {
    coachId: r.coach_id,
    trainId: r.train_id,
    classId: r.class_id,
    coachCode: r.coach_code,
    sequenceNumber: r.sequence_number,
    totalSeats: r.total_seats
  };
}

function mapSeat(r) {
  return {
    seatId: r.seat_id,
    coachId: r.coach_id,
    seatNumber: r.seat_number,
    berthType: r.berth_type
  };
}

function mapFare(r) {
  return {
    fareId: r.fare_id,
    classId: r.class_id,
    minDistanceKm: r.min_distance_km,
    maxDistanceKm: r.max_distance_km,
    ratePerKm: parseFloat(r.rate_per_km)
  };
}

function mapConcessionRule(r) {
  let proofTypes = r.proof_types;
  if (typeof proofTypes === 'string') {
    try {
      proofTypes = JSON.parse(proofTypes);
    } catch (_) {}
  }
  return {
    ruleId: r.rule_id,
    concessionType: r.concession_type,
    classId: r.class_id,
    trainGroup: r.train_group,
    discountPct: parseFloat(r.discount_pct),
    proofTypes,
    isActive: Boolean(r.is_active)
  };
}

function mapRefundRule(r) {
  return {
    ruleId: r.rule_id,
    minHours: r.min_hours,
    maxHours: r.max_hours !== null ? r.max_hours : null,
    deductionPct: parseFloat(r.deduction_pct),
    flatMinCharge: parseFloat(r.flat_min_charge),
    clerkage: parseFloat(r.clerkage)
  };
}

// =============================================================================
// 1. STATIONS
// =============================================================================

async function listStations(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT station_id, station_code, station_name, display_name, city, state, platform_count FROM STATION ORDER BY station_id ASC'
    );
    return res.status(200).json({ success: true, data: rows.map(mapStation) });
  } catch (err) {
    next(err);
  }
}

async function getStation(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT station_id, station_code, station_name, display_name, city, state, platform_count FROM STATION WHERE station_id = ? OR station_code = ?',
      [numId || -1, String(id).toUpperCase()]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Station not found', 404);
    }
    return res.status(200).json({ success: true, data: mapStation(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createStation(req, res, next) {
  let conn;
  try {
    const { stationCode, stationName, displayName, city, state, platformCount = 1 } = req.body;
    if (!stationCode || !stationName || !city || !state) {
      throw new AppError('VALIDATION_ERROR', 'stationCode, stationName, city, and state are required', 400);
    }
    const pCount = parseInt(platformCount, 10);
    if (isNaN(pCount) || pCount < 1) {
      throw new AppError('VALIDATION_ERROR', 'platformCount must be an integer >= 1', 400);
    }

    const code = String(stationCode).trim().toUpperCase();
    const [existing] = await pool.query('SELECT station_id FROM STATION WHERE station_code = ?', [code]);
    if (existing.length > 0) {
      throw new AppError('CONFLICT', `Station code ${code} is already registered`, 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(station_id), 0) + 1 AS next_id FROM STATION FOR UPDATE');
    const newStationId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO STATION (station_id, station_code, station_name, display_name, city, state, platform_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newStationId, code, stationName.trim(), (displayName || stationName).trim(), city.trim(), state.trim(), pCount]
    );

    const auditNewVal = JSON.stringify({
      stationId: newStationId,
      stationCode: code,
      stationName: stationName.trim(),
      city: city.trim(),
      state: state.trim(),
      platformCount: pCount
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_STATION', 'STATION', ?, NULL, ?, NOW())`,
      [req.user.userId, String(newStationId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        stationId: newStationId,
        stationCode: code,
        stationName: stationName.trim(),
        displayName: (displayName || stationName).trim(),
        city: city.trim(),
        state: state.trim(),
        platformCount: pCount
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateStation(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      throw new AppError('VALIDATION_ERROR', 'Valid stationId is required', 400);
    }

    const [existing] = await pool.query('SELECT * FROM STATION WHERE station_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Station not found', 404);
    }
    const oldRow = existing[0];

    const { stationName, displayName, city, state, platformCount } = req.body;
    const updatedName = stationName !== undefined ? String(stationName).trim() : oldRow.station_name;
    const updatedDisplay = displayName !== undefined ? String(displayName).trim() : oldRow.display_name;
    const updatedCity = city !== undefined ? String(city).trim() : oldRow.city;
    const updatedState = state !== undefined ? String(state).trim() : oldRow.state;
    const updatedPlatformCount = platformCount !== undefined ? parseInt(platformCount, 10) : oldRow.platform_count;

    if (isNaN(updatedPlatformCount) || updatedPlatformCount < 1) {
      throw new AppError('VALIDATION_ERROR', 'platformCount must be >= 1', 400);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE STATION SET station_name = ?, display_name = ?, city = ?, state = ?, platform_count = ?
       WHERE station_id = ?`,
      [updatedName, updatedDisplay, updatedCity, updatedState, updatedPlatformCount, numId]
    );

    const oldVal = JSON.stringify(mapStation(oldRow));
    const newVal = JSON.stringify({
      stationId: numId,
      stationCode: oldRow.station_code,
      stationName: updatedName,
      displayName: updatedDisplay,
      city: updatedCity,
      state: updatedState,
      platformCount: updatedPlatformCount
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_STATION', 'STATION', ?, ?, ?, NOW())`,
      [req.user.userId, String(numId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        stationId: numId,
        stationCode: oldRow.station_code,
        stationName: updatedName,
        displayName: updatedDisplay,
        city: updatedCity,
        state: updatedState,
        platformCount: updatedPlatformCount
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function deleteStation(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      throw new AppError('VALIDATION_ERROR', 'Valid stationId is required', 400);
    }

    const [existing] = await pool.query('SELECT * FROM STATION WHERE station_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Station not found', 404);
    }

    // Referential integrity safe checks
    const [trainRef] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM TRAIN WHERE source_station_id = ? OR destination_station_id = ?',
      [numId, numId]
    );
    const [stopRef] = await pool.query('SELECT COUNT(*) AS cnt FROM ROUTE_STOP WHERE station_id = ?', [numId]);
    const [assignRef] = await pool.query('SELECT COUNT(*) AS cnt FROM STAFF_ASSIGNMENT WHERE station_id = ?', [numId]);

    if (trainRef[0].cnt > 0 || stopRef[0].cnt > 0 || assignRef[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot delete station: referenced by trains, route stops, or staff assignments', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM PLATFORM WHERE station_id = ?', [numId]);
    await conn.query('DELETE FROM STATION WHERE station_id = ?', [numId]);

    const oldVal = JSON.stringify(mapStation(existing[0]));
    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'DELETE_STATION', 'STATION', ?, ?, NULL, NOW())`,
      [req.user.userId, String(numId), oldVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Station deleted successfully'
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// =============================================================================
// 2. TRAINS
// =============================================================================

async function listTrains(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT train_id, train_number, short_name, display_name, train_type, source_station_id, destination_station_id, running_days, status FROM TRAIN ORDER BY train_id ASC'
    );
    return res.status(200).json({ success: true, data: rows.map(mapTrain) });
  } catch (err) {
    next(err);
  }
}

async function getTrain(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT train_id, train_number, short_name, display_name, train_type, source_station_id, destination_station_id, running_days, status FROM TRAIN WHERE train_id = ? OR train_number = ?',
      [numId || -1, String(id)]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Train not found', 404);
    }
    return res.status(200).json({ success: true, data: mapTrain(rows[0]) });
  } catch (err) {
    next(err);
  }
}

const VALID_TRAIN_TYPES = ['RAJDHANI', 'SHATABDI', 'DURONTO', 'EXPRESS', 'VANDE_BHARAT'];

async function createTrain(req, res, next) {
  let conn;
  try {
    const {
      trainNumber,
      shortName,
      displayName,
      trainType,
      sourceStationId,
      destinationStationId,
      runningDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      status = 'ACTIVE'
    } = req.body;

    if (!trainNumber || !shortName || !trainType || !sourceStationId || !destinationStationId) {
      throw new AppError('VALIDATION_ERROR', 'trainNumber, shortName, trainType, sourceStationId, and destinationStationId are required', 400);
    }

    if (!VALID_TRAIN_TYPES.includes(trainType)) {
      throw new AppError('VALIDATION_ERROR', `Invalid trainType. Must be one of: ${VALID_TRAIN_TYPES.join(', ')}`, 400);
    }

    const tNumber = String(trainNumber).trim();
    const [existing] = await pool.query('SELECT train_id FROM TRAIN WHERE train_number = ?', [tNumber]);
    if (existing.length > 0) {
      throw new AppError('CONFLICT', `Train number ${tNumber} already exists`, 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(train_id), 0) + 1 AS next_id FROM TRAIN FOR UPDATE');
    const newTrainId = maxRows[0].next_id;

    const daysJson = JSON.stringify(Array.isArray(runningDays) ? runningDays : [runningDays]);

    await conn.query(
      `INSERT INTO TRAIN (train_id, train_number, short_name, display_name, train_type, source_station_id, destination_station_id, running_days, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newTrainId, tNumber, shortName.trim(), (displayName || shortName).trim(), trainType, Number(sourceStationId), Number(destinationStationId), daysJson, status]
    );

    const auditNewVal = JSON.stringify({
      trainId: newTrainId,
      trainNumber: tNumber,
      shortName: shortName.trim(),
      trainType,
      sourceStationId: Number(sourceStationId),
      destinationStationId: Number(destinationStationId),
      runningDays,
      status
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_TRAIN', 'TRAIN', ?, NULL, ?, NOW())`,
      [req.user.userId, String(newTrainId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        trainId: newTrainId,
        trainNumber: tNumber,
        shortName: shortName.trim(),
        displayName: (displayName || shortName).trim(),
        trainType,
        sourceStationId: Number(sourceStationId),
        destinationStationId: Number(destinationStationId),
        runningDays: Array.isArray(runningDays) ? runningDays : [runningDays],
        status
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateTrain(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      throw new AppError('VALIDATION_ERROR', 'Valid trainId is required', 400);
    }

    const [existing] = await pool.query('SELECT * FROM TRAIN WHERE train_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Train not found', 404);
    }
    const oldRow = existing[0];

    const { shortName, displayName, trainType, sourceStationId, destinationStationId, runningDays, status } = req.body;

    // Safe rule: if schedules exist, changing route endpoints or train_type is refused
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [numId]);
    const hasSchedules = schedCount[0].cnt > 0;

    if (hasSchedules) {
      if (
        (sourceStationId !== undefined && Number(sourceStationId) !== oldRow.source_station_id) ||
        (destinationStationId !== undefined && Number(destinationStationId) !== oldRow.destination_station_id) ||
        (trainType !== undefined && trainType !== oldRow.train_type)
      ) {
        throw new AppError('CONFLICT', 'Cannot alter train endpoints or train type when active schedules exist', 409);
      }
    }

    const updatedShort = shortName !== undefined ? String(shortName).trim() : oldRow.short_name;
    const updatedDisplay = displayName !== undefined ? String(displayName).trim() : oldRow.display_name;
    const updatedType = trainType !== undefined ? trainType : oldRow.train_type;
    const updatedSrc = sourceStationId !== undefined ? Number(sourceStationId) : oldRow.source_station_id;
    const updatedDest = destinationStationId !== undefined ? Number(destinationStationId) : oldRow.destination_station_id;
    const updatedStatus = status !== undefined ? status : oldRow.status;
    let updatedDays = oldRow.running_days;
    if (runningDays !== undefined) {
      updatedDays = JSON.stringify(Array.isArray(runningDays) ? runningDays : [runningDays]);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE TRAIN SET short_name = ?, display_name = ?, train_type = ?, source_station_id = ?, destination_station_id = ?, running_days = ?, status = ?
       WHERE train_id = ?`,
      [updatedShort, updatedDisplay, updatedType, updatedSrc, updatedDest, updatedDays, updatedStatus, numId]
    );

    const oldVal = JSON.stringify(mapTrain(oldRow));
    const newVal = JSON.stringify({
      trainId: numId,
      trainNumber: oldRow.train_number,
      shortName: updatedShort,
      displayName: updatedDisplay,
      trainType: updatedType,
      sourceStationId: updatedSrc,
      destinationStationId: updatedDest,
      status: updatedStatus
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_TRAIN', 'TRAIN', ?, ?, ?, NOW())`,
      [req.user.userId, String(numId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        trainId: numId,
        trainNumber: oldRow.train_number,
        shortName: updatedShort,
        displayName: updatedDisplay,
        trainType: updatedType,
        sourceStationId: updatedSrc,
        destinationStationId: updatedDest,
        runningDays: typeof updatedDays === 'string' ? JSON.parse(updatedDays) : updatedDays,
        status: updatedStatus
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function deleteTrain(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!numId || isNaN(numId)) {
      throw new AppError('VALIDATION_ERROR', 'Valid trainId is required', 400);
    }

    const [existing] = await pool.query('SELECT * FROM TRAIN WHERE train_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Train not found', 404);
    }

    // Safe rule: refused when schedules exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [numId]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot delete train: active schedules or bookings exist', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM ROUTE_STOP WHERE train_id = ?', [numId]);
    await conn.query('DELETE FROM COACH WHERE train_id = ?', [numId]);
    await conn.query('DELETE FROM TRAIN WHERE train_id = ?', [numId]);

    const oldVal = JSON.stringify(mapTrain(existing[0]));
    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'DELETE_TRAIN', 'TRAIN', ?, ?, NULL, NOW())`,
      [req.user.userId, String(numId), oldVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Train deleted successfully'
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// =============================================================================
// 3. ROUTE STOPS (ROUTES)
// =============================================================================

async function listRoutes(req, res, next) {
  try {
    const { trainId } = req.query;
    let sql = 'SELECT stop_id, train_id, station_id, stop_sequence, arrival_time, departure_time, day_offset, distance_from_origin, platform_number FROM ROUTE_STOP';
    const params = [];
    if (trainId) {
      sql += ' WHERE train_id = ?';
      params.push(Number(trainId));
    }
    sql += ' ORDER BY train_id ASC, stop_sequence ASC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: rows.map(mapRouteStop) });
  } catch (err) {
    next(err);
  }
}

async function getRouteStop(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT stop_id, train_id, station_id, stop_sequence, arrival_time, departure_time, day_offset, distance_from_origin, platform_number FROM ROUTE_STOP WHERE stop_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Route stop not found', 404);
    }
    return res.status(200).json({ success: true, data: mapRouteStop(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createRouteStop(req, res, next) {
  let conn;
  try {
    const { trainId, stationId, stopSequence, arrivalTime, departureTime, dayOffset = 0, distanceFromOrigin = 0, platformNumber = 1 } = req.body;
    if (!trainId || !stationId || !stopSequence || !arrivalTime || !departureTime) {
      throw new AppError('VALIDATION_ERROR', 'trainId, stationId, stopSequence, arrivalTime, and departureTime are required', 400);
    }

    // Safe rule: no change that breaks existing runs
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [Number(trainId)]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot add route stops: active schedules or bookings exist for this train', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(stop_id), 0) + 1 AS next_id FROM ROUTE_STOP FOR UPDATE');
    const newStopId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO ROUTE_STOP (stop_id, train_id, station_id, stop_sequence, arrival_time, departure_time, day_offset, distance_from_origin, platform_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newStopId, Number(trainId), Number(stationId), Number(stopSequence), arrivalTime, departureTime, Number(dayOffset), Number(distanceFromOrigin), Number(platformNumber)]
    );

    const auditNewVal = JSON.stringify({
      stopId: newStopId,
      trainId: Number(trainId),
      stationId: Number(stationId),
      stopSequence: Number(stopSequence),
      arrivalTime,
      departureTime
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_ROUTE_STOP', 'ROUTE_STOP', ?, NULL, ?, NOW())`,
      [req.user.userId, String(newStopId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        stopId: newStopId,
        trainId: Number(trainId),
        stationId: Number(stationId),
        stopSequence: Number(stopSequence),
        arrivalTime,
        departureTime,
        dayOffset: Number(dayOffset),
        distanceFromOrigin: Number(distanceFromOrigin),
        platformNumber: Number(platformNumber)
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateRouteStop(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM ROUTE_STOP WHERE stop_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Route stop not found', 404);
    }
    const oldRow = existing[0];

    // Safe rule: check if schedules exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [oldRow.train_id]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot modify route stops: active schedules or bookings exist for this train', 409);
    }

    const { stationId, stopSequence, arrivalTime, departureTime, dayOffset, distanceFromOrigin, platformNumber } = req.body;
    const updatedStation = stationId !== undefined ? Number(stationId) : oldRow.station_id;
    const updatedSeq = stopSequence !== undefined ? Number(stopSequence) : oldRow.stop_sequence;
    const updatedArr = arrivalTime !== undefined ? arrivalTime : oldRow.arrival_time;
    const updatedDep = departureTime !== undefined ? departureTime : oldRow.departure_time;
    const updatedDay = dayOffset !== undefined ? Number(dayOffset) : oldRow.day_offset;
    const updatedDist = distanceFromOrigin !== undefined ? Number(distanceFromOrigin) : oldRow.distance_from_origin;
    const updatedPlat = platformNumber !== undefined ? Number(platformNumber) : oldRow.platform_number;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE ROUTE_STOP SET station_id = ?, stop_sequence = ?, arrival_time = ?, departure_time = ?, day_offset = ?, distance_from_origin = ?, platform_number = ?
       WHERE stop_id = ?`,
      [updatedStation, updatedSeq, updatedArr, updatedDep, updatedDay, updatedDist, updatedPlat, numId]
    );

    const oldVal = JSON.stringify(mapRouteStop(oldRow));
    const newVal = JSON.stringify({
      stopId: numId,
      trainId: oldRow.train_id,
      stationId: updatedStation,
      stopSequence: updatedSeq,
      arrivalTime: updatedArr,
      departureTime: updatedDep
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_ROUTE_STOP', 'ROUTE_STOP', ?, ?, ?, NOW())`,
      [req.user.userId, String(numId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        stopId: numId,
        trainId: oldRow.train_id,
        stationId: updatedStation,
        stopSequence: updatedSeq,
        arrivalTime: updatedArr,
        departureTime: updatedDep,
        dayOffset: updatedDay,
        distanceFromOrigin: updatedDist,
        platformNumber: updatedPlat
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function deleteRouteStop(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM ROUTE_STOP WHERE stop_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Route stop not found', 404);
    }
    const oldRow = existing[0];

    // Safe rule: check if schedules or bookings exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [oldRow.train_id]);
    const [bookingCount] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM BOOKING WHERE from_stop_id = ? OR to_stop_id = ?',
      [numId, numId]
    );

    if (schedCount[0].cnt > 0 || bookingCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot delete route stop: active schedules or bookings exist for this train', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM ROUTE_STOP WHERE stop_id = ?', [numId]);

    const oldVal = JSON.stringify(mapRouteStop(oldRow));
    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'DELETE_ROUTE_STOP', 'ROUTE_STOP', ?, ?, NULL, NOW())`,
      [req.user.userId, String(numId), oldVal]
    );

    await conn.commit();

    return res.status(200).json({ success: true, message: 'Route stop deleted successfully' });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// =============================================================================
// 4. COACHES
// =============================================================================

async function listCoaches(req, res, next) {
  try {
    const { trainId } = req.query;
    let sql = 'SELECT coach_id, train_id, class_id, coach_code, sequence_number, total_seats FROM COACH';
    const params = [];
    if (trainId) {
      sql += ' WHERE train_id = ?';
      params.push(Number(trainId));
    }
    sql += ' ORDER BY train_id ASC, sequence_number ASC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: rows.map(mapCoach) });
  } catch (err) {
    next(err);
  }
}

async function getCoach(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT coach_id, train_id, class_id, coach_code, sequence_number, total_seats FROM COACH WHERE coach_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Coach not found', 404);
    }
    return res.status(200).json({ success: true, data: mapCoach(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createCoach(req, res, next) {
  let conn;
  try {
    const { trainId, classId, coachCode, sequenceNumber, totalSeats } = req.body;
    if (!trainId || !classId || !coachCode || !sequenceNumber || !totalSeats) {
      throw new AppError('VALIDATION_ERROR', 'trainId, classId, coachCode, sequenceNumber, and totalSeats are required', 400);
    }

    // Safe rule: check if schedules exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [Number(trainId)]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot add coaches: active schedules or bookings exist for this train', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(coach_id), 0) + 1 AS next_id FROM COACH FOR UPDATE');
    const newCoachId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO COACH (coach_id, train_id, class_id, coach_code, sequence_number, total_seats)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newCoachId, Number(trainId), Number(classId), String(coachCode).trim().toUpperCase(), Number(sequenceNumber), Number(totalSeats)]
    );

    const auditNewVal = JSON.stringify({
      coachId: newCoachId,
      trainId: Number(trainId),
      classId: Number(classId),
      coachCode: String(coachCode).trim().toUpperCase(),
      sequenceNumber: Number(sequenceNumber),
      totalSeats: Number(totalSeats)
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_COACH', 'COACH', ?, NULL, ?, NOW())`,
      [req.user.userId, String(newCoachId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        coachId: newCoachId,
        trainId: Number(trainId),
        classId: Number(classId),
        coachCode: String(coachCode).trim().toUpperCase(),
        sequenceNumber: Number(sequenceNumber),
        totalSeats: Number(totalSeats)
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateCoach(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM COACH WHERE coach_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Coach not found', 404);
    }
    const oldRow = existing[0];

    // Safe rule: check if schedules exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [oldRow.train_id]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot modify coach: active schedules or bookings exist for this train', 409);
    }

    const { classId, coachCode, sequenceNumber, totalSeats } = req.body;
    const updatedClass = classId !== undefined ? Number(classId) : oldRow.class_id;
    const updatedCode = coachCode !== undefined ? String(coachCode).trim().toUpperCase() : oldRow.coach_code;
    const updatedSeq = sequenceNumber !== undefined ? Number(sequenceNumber) : oldRow.sequence_number;
    const updatedSeats = totalSeats !== undefined ? Number(totalSeats) : oldRow.total_seats;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE COACH SET class_id = ?, coach_code = ?, sequence_number = ?, total_seats = ?
       WHERE coach_id = ?`,
      [updatedClass, updatedCode, updatedSeq, updatedSeats, numId]
    );

    const oldVal = JSON.stringify(mapCoach(oldRow));
    const newVal = JSON.stringify({
      coachId: numId,
      trainId: oldRow.train_id,
      classId: updatedClass,
      coachCode: updatedCode,
      sequenceNumber: updatedSeq,
      totalSeats: updatedSeats
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_COACH', 'COACH', ?, ?, ?, NOW())`,
      [req.user.userId, String(numId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        coachId: numId,
        trainId: oldRow.train_id,
        classId: updatedClass,
        coachCode: updatedCode,
        sequenceNumber: updatedSeq,
        totalSeats: updatedSeats
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function deleteCoach(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM COACH WHERE coach_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Coach not found', 404);
    }
    const oldRow = existing[0];

    // Safe rule: check if schedules or physical seats exist
    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [oldRow.train_id]);
    const [seatCount] = await pool.query('SELECT COUNT(*) AS cnt FROM SEAT WHERE coach_id = ?', [numId]);

    if (schedCount[0].cnt > 0 || seatCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot delete coach: active schedules or physical seats exist', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM COACH WHERE coach_id = ?', [numId]);

    const oldVal = JSON.stringify(mapCoach(oldRow));
    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'DELETE_COACH', 'COACH', ?, ?, NULL, NOW())`,
      [req.user.userId, String(numId), oldVal]
    );

    await conn.commit();

    return res.status(200).json({ success: true, message: 'Coach deleted successfully' });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// =============================================================================
// 5. SEATS
// =============================================================================

const VALID_BERTH_TYPES = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER', 'WINDOW', 'AISLE', 'NO_BERTH'];

async function listSeats(req, res, next) {
  try {
    const { coachId, page = 1, limit = 100 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
    const offset = (p - 1) * l;

    let sql = 'SELECT seat_id, coach_id, seat_number, berth_type FROM SEAT';
    const params = [];
    if (coachId) {
      sql += ' WHERE coach_id = ?';
      params.push(Number(coachId));
    }
    sql += ' ORDER BY coach_id ASC, seat_number ASC LIMIT ? OFFSET ?';
    params.push(l, offset);

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: rows.map(mapSeat) });
  } catch (err) {
    next(err);
  }
}

async function getSeat(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT seat_id, coach_id, seat_number, berth_type FROM SEAT WHERE seat_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Seat not found', 404);
    }
    return res.status(200).json({ success: true, data: mapSeat(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createSeat(req, res, next) {
  let conn;
  try {
    const { coachId, seatNumber, berthType } = req.body;
    if (!coachId || !seatNumber || !berthType) {
      throw new AppError('VALIDATION_ERROR', 'coachId, seatNumber, and berthType are required', 400);
    }
    if (!VALID_BERTH_TYPES.includes(berthType)) {
      throw new AppError('VALIDATION_ERROR', `Invalid berthType. Must be one of: ${VALID_BERTH_TYPES.join(', ')}`, 400);
    }

    // Safe rule: check if schedules exist for coach's train
    const [coachRows] = await pool.query('SELECT train_id FROM COACH WHERE coach_id = ?', [Number(coachId)]);
    if (coachRows.length === 0) {
      throw new AppError('NOT_FOUND', 'Coach not found', 404);
    }
    const trainId = coachRows[0].train_id;

    const [schedCount] = await pool.query('SELECT COUNT(*) AS cnt FROM TRAIN_SCHEDULE WHERE train_id = ?', [trainId]);
    if (schedCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot add seats: active schedules or bookings exist for this train', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(seat_id), 0) + 1 AS next_id FROM SEAT FOR UPDATE');
    const newSeatId = maxRows[0].next_id;

    await conn.query(
      'INSERT INTO SEAT (seat_id, coach_id, seat_number, berth_type) VALUES (?, ?, ?, ?)',
      [newSeatId, Number(coachId), Number(seatNumber), berthType]
    );

    const auditNewVal = JSON.stringify({
      seatId: newSeatId,
      coachId: Number(coachId),
      seatNumber: Number(seatNumber),
      berthType
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'CREATE_SEAT', 'SEAT', ?, NULL, ?, NOW())`,
      [req.user.userId, String(newSeatId), auditNewVal]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        seatId: newSeatId,
        coachId: Number(coachId),
        seatNumber: Number(seatNumber),
        berthType
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateSeat(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM SEAT WHERE seat_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Seat not found', 404);
    }
    const oldRow = existing[0];

    // Safe rule: check if referenced in RESERVATION
    const [resCount] = await pool.query('SELECT COUNT(*) AS cnt FROM RESERVATION WHERE seat_id = ?', [numId]);
    if (resCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot modify seat: active reservations exist', 409);
    }

    const { seatNumber, berthType } = req.body;
    const updatedSeatNo = seatNumber !== undefined ? Number(seatNumber) : oldRow.seat_number;
    const updatedBerth = berthType !== undefined ? berthType : oldRow.berth_type;

    if (berthType && !VALID_BERTH_TYPES.includes(berthType)) {
      throw new AppError('VALIDATION_ERROR', `Invalid berthType: ${berthType}`, 400);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('UPDATE SEAT SET seat_number = ?, berth_type = ? WHERE seat_id = ?', [updatedSeatNo, updatedBerth, numId]);

    const oldVal = JSON.stringify(mapSeat(oldRow));
    const newVal = JSON.stringify({
      seatId: numId,
      coachId: oldRow.coach_id,
      seatNumber: updatedSeatNo,
      berthType: updatedBerth
    });

    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'UPDATE_SEAT', 'SEAT', ?, ?, ?, NOW())`,
      [req.user.userId, String(numId), oldVal, newVal]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      data: {
        seatId: numId,
        coachId: oldRow.coach_id,
        seatNumber: updatedSeatNo,
        berthType: updatedBerth
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function deleteSeat(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM SEAT WHERE seat_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Seat not found', 404);
    }

    // Safe rule: refused when referenced in RESERVATION
    const [resCount] = await pool.query('SELECT COUNT(*) AS cnt FROM RESERVATION WHERE seat_id = ?', [numId]);
    if (resCount[0].cnt > 0) {
      throw new AppError('CONFLICT', 'Cannot delete seat: active reservations exist', 409);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM SEAT WHERE seat_id = ?', [numId]);

    const oldVal = JSON.stringify(mapSeat(existing[0]));
    await conn.query(
      `INSERT INTO AUDIT_LOG (user_id, action, table_name, record_id, old_value, new_value, logged_at)
       VALUES (?, 'DELETE_SEAT', 'SEAT', ?, ?, NULL, NOW())`,
      [req.user.userId, String(numId), oldVal]
    );

    await conn.commit();

    return res.status(200).json({ success: true, message: 'Seat deleted successfully' });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// =============================================================================
// 6. FARES (Node writes NO audit row; audited by trg_audit_fare_change)
// =============================================================================

async function listFares(req, res, next) {
  try {
    const { classId } = req.query;
    let sql = 'SELECT fare_id, class_id, min_distance_km, max_distance_km, rate_per_km FROM FARE';
    const params = [];
    if (classId) {
      sql += ' WHERE class_id = ?';
      params.push(Number(classId));
    }
    sql += ' ORDER BY class_id ASC, min_distance_km ASC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: rows.map(mapFare) });
  } catch (err) {
    next(err);
  }
}

async function getFare(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT fare_id, class_id, min_distance_km, max_distance_km, rate_per_km FROM FARE WHERE fare_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Fare rule not found', 404);
    }
    return res.status(200).json({ success: true, data: mapFare(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createFare(req, res, next) {
  let conn;
  try {
    const { classId, minDistanceKm, maxDistanceKm, ratePerKm } = req.body;
    if (!classId || minDistanceKm === undefined || maxDistanceKm === undefined || ratePerKm === undefined) {
      throw new AppError('VALIDATION_ERROR', 'classId, minDistanceKm, maxDistanceKm, and ratePerKm are required', 400);
    }

    const minKm = Number(minDistanceKm);
    const maxKm = Number(maxDistanceKm);
    const rate = parseFloat(ratePerKm);

    if (isNaN(minKm) || isNaN(maxKm) || isNaN(rate) || minKm < 0 || maxKm <= minKm || rate <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Invalid distance slab or ratePerKm', 400);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(fare_id), 0) + 1 AS next_id FROM FARE FOR UPDATE');
    const newFareId = maxRows[0].next_id;

    await conn.query(
      'INSERT INTO FARE (fare_id, class_id, min_distance_km, max_distance_km, rate_per_km) VALUES (?, ?, ?, ?, ?)',
      [newFareId, Number(classId), minKm, maxKm, rate]
    );

    // Node writes NO audit row; trigger trg_audit_fare_change handles auditing

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        fareId: newFareId,
        classId: Number(classId),
        minDistanceKm: minKm,
        maxDistanceKm: maxKm,
        ratePerKm: rate
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateFare(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM FARE WHERE fare_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Fare rule not found', 404);
    }
    const oldRow = existing[0];

    const { classId, minDistanceKm, maxDistanceKm, ratePerKm } = req.body;
    const updatedClass = classId !== undefined ? Number(classId) : oldRow.class_id;
    const updatedMin = minDistanceKm !== undefined ? Number(minDistanceKm) : oldRow.min_distance_km;
    const updatedMax = maxDistanceKm !== undefined ? Number(maxDistanceKm) : oldRow.max_distance_km;
    const updatedRate = ratePerKm !== undefined ? parseFloat(ratePerKm) : parseFloat(oldRow.rate_per_km);

    // Update FARE directly in MySQL; trigger trg_audit_fare_change automatically creates AUDIT_LOG row
    await pool.query(
      'UPDATE FARE SET class_id = ?, min_distance_km = ?, max_distance_km = ?, rate_per_km = ? WHERE fare_id = ?',
      [updatedClass, updatedMin, updatedMax, updatedRate, numId]
    );

    return res.status(200).json({
      success: true,
      data: {
        fareId: numId,
        classId: updatedClass,
        minDistanceKm: updatedMin,
        maxDistanceKm: updatedMax,
        ratePerKm: updatedRate
      }
    });
  } catch (err) {
    next(err);
  }
}

async function deleteFare(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM FARE WHERE fare_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Fare rule not found', 404);
    }

    await pool.query('DELETE FROM FARE WHERE fare_id = ?', [numId]);
    return res.status(200).json({ success: true, message: 'Fare rule deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// 7. CONCESSION RULES (Node writes NO audit row; audited by trg_audit_concession_change)
// =============================================================================

const VALID_CONC_TYPES = ['NONE', 'DIVYAANG', 'SENIOR_CITIZEN'];

async function listConcessionRules(req, res, next) {
  try {
    const { concessionType } = req.query;
    let sql = 'SELECT rule_id, concession_type, class_id, train_group, discount_pct, proof_types, is_active FROM CONCESSION_RULE';
    const params = [];
    if (concessionType) {
      sql += ' WHERE concession_type = ?';
      params.push(concessionType);
    }
    sql += ' ORDER BY rule_id ASC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: rows.map(mapConcessionRule) });
  } catch (err) {
    next(err);
  }
}

async function getConcessionRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT rule_id, concession_type, class_id, train_group, discount_pct, proof_types, is_active FROM CONCESSION_RULE WHERE rule_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Concession rule not found', 404);
    }
    return res.status(200).json({ success: true, data: mapConcessionRule(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createConcessionRule(req, res, next) {
  let conn;
  try {
    const { concessionType, classId, trainGroup = 'ALL', discountPct, proofTypes = [], isActive = true } = req.body;
    if (!concessionType || !classId || discountPct === undefined) {
      throw new AppError('VALIDATION_ERROR', 'concessionType, classId, and discountPct are required', 400);
    }
    if (!VALID_CONC_TYPES.includes(concessionType)) {
      throw new AppError('VALIDATION_ERROR', `Invalid concessionType: ${concessionType}`, 400);
    }
    const discount = parseFloat(discountPct);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      throw new AppError('VALIDATION_ERROR', 'discountPct must be between 0 and 100', 400);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(rule_id), 0) + 1 AS next_id FROM CONCESSION_RULE FOR UPDATE');
    const newRuleId = maxRows[0].next_id;

    const proofJson = JSON.stringify(Array.isArray(proofTypes) ? proofTypes : [proofTypes]);

    await conn.query(
      `INSERT INTO CONCESSION_RULE (rule_id, concession_type, class_id, train_group, discount_pct, proof_types, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newRuleId, concessionType, Number(classId), String(trainGroup).trim(), discount, proofJson, isActive ? 1 : 0]
    );

    // Node writes NO audit row; trigger trg_audit_concession_change handles auditing
    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        ruleId: newRuleId,
        concessionType,
        classId: Number(classId),
        trainGroup: String(trainGroup).trim(),
        discountPct: discount,
        proofTypes: Array.isArray(proofTypes) ? proofTypes : [proofTypes],
        isActive: Boolean(isActive)
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateConcessionRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM CONCESSION_RULE WHERE rule_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Concession rule not found', 404);
    }
    const oldRow = existing[0];

    const { concessionType, classId, trainGroup, discountPct, proofTypes, isActive } = req.body;
    const updatedType = concessionType !== undefined ? concessionType : oldRow.concession_type;
    const updatedClass = classId !== undefined ? Number(classId) : oldRow.class_id;
    const updatedGroup = trainGroup !== undefined ? String(trainGroup).trim() : oldRow.train_group;
    const updatedDiscount = discountPct !== undefined ? parseFloat(discountPct) : parseFloat(oldRow.discount_pct);
    const updatedActive = isActive !== undefined ? (isActive ? 1 : 0) : oldRow.is_active;
    let updatedProof = oldRow.proof_types;
    if (proofTypes !== undefined) {
      updatedProof = Array.isArray(proofTypes) ? proofTypes : [proofTypes];
    } else if (typeof updatedProof === 'string') {
      try { updatedProof = JSON.parse(updatedProof); } catch (_) {}
    }
    const proofJson = JSON.stringify(updatedProof);

    // Update in MySQL; trigger trg_audit_concession_change automatically records into AUDIT_LOG
    await pool.query(
      `UPDATE CONCESSION_RULE SET concession_type = ?, class_id = ?, train_group = ?, discount_pct = ?, proof_types = ?, is_active = ?
       WHERE rule_id = ?`,
      [updatedType, updatedClass, updatedGroup, updatedDiscount, proofJson, updatedActive, numId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ruleId: numId,
        concessionType: updatedType,
        classId: updatedClass,
        trainGroup: updatedGroup,
        discountPct: updatedDiscount,
        proofTypes: Array.isArray(updatedProof) ? updatedProof : [updatedProof],
        isActive: Boolean(updatedActive)
      }
    });
  } catch (err) {
    next(err);
  }
}

async function deleteConcessionRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM CONCESSION_RULE WHERE rule_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Concession rule not found', 404);
    }

    await pool.query('DELETE FROM CONCESSION_RULE WHERE rule_id = ?', [numId]);
    return res.status(200).json({ success: true, message: 'Concession rule deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// 8. REFUND RULES (Node writes NO audit row; audited by trg_audit_refund_rule_change)
// =============================================================================

async function listRefundRules(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT rule_id, min_hours, max_hours, deduction_pct, flat_min_charge, clerkage FROM REFUND_RULE ORDER BY rule_id ASC'
    );
    return res.status(200).json({ success: true, data: rows.map(mapRefundRule) });
  } catch (err) {
    next(err);
  }
}

async function getRefundRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [rows] = await pool.query(
      'SELECT rule_id, min_hours, max_hours, deduction_pct, flat_min_charge, clerkage FROM REFUND_RULE WHERE rule_id = ?',
      [numId]
    );
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Refund rule not found', 404);
    }
    return res.status(200).json({ success: true, data: mapRefundRule(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function createRefundRule(req, res, next) {
  let conn;
  try {
    const { minHours, maxHours = null, deductionPct, flatMinCharge = 0, clerkage = 60 } = req.body;
    if (minHours === undefined || deductionPct === undefined) {
      throw new AppError('VALIDATION_ERROR', 'minHours and deductionPct are required', 400);
    }
    const minH = parseInt(minHours, 10);
    const maxH = maxHours !== null && maxHours !== undefined ? parseInt(maxHours, 10) : null;
    const pct = parseFloat(deductionPct);
    const flat = parseFloat(flatMinCharge);
    const clerk = parseFloat(clerkage);

    if (isNaN(minH) || isNaN(pct) || pct < 0 || pct > 100) {
      throw new AppError('VALIDATION_ERROR', 'Invalid minHours or deductionPct', 400);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(rule_id), 0) + 1 AS next_id FROM REFUND_RULE FOR UPDATE');
    const newRuleId = maxRows[0].next_id;

    await conn.query(
      `INSERT INTO REFUND_RULE (rule_id, min_hours, max_hours, deduction_pct, flat_min_charge, clerkage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newRuleId, minH, maxH, pct, flat, clerk]
    );

    // Node writes NO audit row; trigger trg_audit_refund_rule_change handles auditing
    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        ruleId: newRuleId,
        minHours: minH,
        maxHours: maxH,
        deductionPct: pct,
        flatMinCharge: flat,
        clerkage: clerk
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateRefundRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM REFUND_RULE WHERE rule_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Refund rule not found', 404);
    }
    const oldRow = existing[0];

    const { minHours, maxHours, deductionPct, flatMinCharge, clerkage } = req.body;
    const updatedMin = minHours !== undefined ? parseInt(minHours, 10) : oldRow.min_hours;
    const updatedMax = maxHours !== undefined ? (maxHours !== null ? parseInt(maxHours, 10) : null) : oldRow.max_hours;
    const updatedPct = deductionPct !== undefined ? parseFloat(deductionPct) : parseFloat(oldRow.deduction_pct);
    const updatedFlat = flatMinCharge !== undefined ? parseFloat(flatMinCharge) : parseFloat(oldRow.flat_min_charge);
    const updatedClerk = clerkage !== undefined ? parseFloat(clerkage) : parseFloat(oldRow.clerkage);

    // Update in MySQL; trigger trg_audit_refund_rule_change automatically records into AUDIT_LOG
    await pool.query(
      `UPDATE REFUND_RULE SET min_hours = ?, max_hours = ?, deduction_pct = ?, flat_min_charge = ?, clerkage = ?
       WHERE rule_id = ?`,
      [updatedMin, updatedMax, updatedPct, updatedFlat, updatedClerk, numId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ruleId: numId,
        minHours: updatedMin,
        maxHours: updatedMax,
        deductionPct: updatedPct,
        flatMinCharge: updatedFlat,
        clerkage: updatedClerk
      }
    });
  } catch (err) {
    next(err);
  }
}

async function deleteRefundRule(req, res, next) {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const [existing] = await pool.query('SELECT * FROM REFUND_RULE WHERE rule_id = ?', [numId]);
    if (existing.length === 0) {
      throw new AppError('NOT_FOUND', 'Refund rule not found', 404);
    }

    await pool.query('DELETE FROM REFUND_RULE WHERE rule_id = ?', [numId]);
    return res.status(200).json({ success: true, message: 'Refund rule deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Stations
  listStations,
  getStation,
  createStation,
  updateStation,
  deleteStation,
  // Trains
  listTrains,
  getTrain,
  createTrain,
  updateTrain,
  deleteTrain,
  // Routes
  listRoutes,
  getRouteStop,
  createRouteStop,
  updateRouteStop,
  deleteRouteStop,
  // Coaches
  listCoaches,
  getCoach,
  createCoach,
  updateCoach,
  deleteCoach,
  // Seats
  listSeats,
  getSeat,
  createSeat,
  updateSeat,
  deleteSeat,
  // Fares
  listFares,
  getFare,
  createFare,
  updateFare,
  deleteFare,
  // Concessions
  listConcessionRules,
  getConcessionRule,
  createConcessionRule,
  updateConcessionRule,
  deleteConcessionRule,
  // Refunds
  listRefundRules,
  getRefundRule,
  createRefundRule,
  updateRefundRule,
  deleteRefundRule
};
