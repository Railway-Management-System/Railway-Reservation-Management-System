const pool = require('../config/mysql');
const { getOrConnectMongoDb } = require('../config/mongodb');
const { formatIndiaDate } = require('../utils/dateUtils');
const AppError = require('../utils/appError');

async function upsertLiveStatus(scheduleId, { delayMinutes, status, platformNumber = null }) {
  try {
    const numScheduleId = Number(scheduleId);
    const [schedRows] = await pool.query(
      'SELECT schedule_id, train_id, journey_date, status, delay_minutes FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
      [numScheduleId]
    );

    if (schedRows.length === 0) return null;
    const sched = schedRows[0];

    const db = await getOrConnectMongoDb();
    if (!db) return null;

    const mins = Number(delayMinutes !== undefined ? delayMinutes : sched.delay_minutes);
    const finalStatus = status || sched.status || (mins > 0 ? 'DELAYED' : 'ON_TIME');
    const journeyDateStr = formatIndiaDate(sched.journey_date);

    const setFields = {
      schedule_id: numScheduleId,
      scheduleId: numScheduleId,
      train_id: sched.train_id,
      trainId: sched.train_id,
      journey_date: journeyDateStr,
      journeyDate: journeyDateStr,
      delay_min: mins,
      delayMinutes: mins,
      status: finalStatus,
      updated_at: new Date()
    };

    if (platformNumber !== null && platformNumber !== undefined) {
      setFields.current_platform = Number(platformNumber);
      setFields.platformNumber = Number(platformNumber);
    }

    await db.collection('live_train_status').updateOne(
      { $or: [{ schedule_id: numScheduleId }, { scheduleId: numScheduleId }] },
      {
        $set: setFields,
        $setOnInsert: {
          _id: `lts_${numScheduleId}`,
          current_platform: 1,
          platformNumber: 1
        }
      },
      { upsert: true }
    );

    return {
      scheduleId: numScheduleId,
      trainId: sched.train_id,
      journeyDate: journeyDateStr,
      status: finalStatus,
      delayMinutes: mins,
      platformNumber: platformNumber !== null && platformNumber !== undefined ? Number(platformNumber) : 1
    };
  } catch (err) {
    console.error('[LiveStatusService] Error upserting live train status:', err.message);
    return null;
  }
}

async function getScheduleLiveStatus(scheduleId) {
  const numScheduleId = Number(scheduleId);
  if (!numScheduleId || isNaN(numScheduleId)) {
    throw new AppError('VALIDATION_ERROR', 'Valid scheduleId is required', 400);
  }

  const [schedRows] = await pool.query(
    'SELECT schedule_id, train_id, journey_date, status, delay_minutes FROM TRAIN_SCHEDULE WHERE schedule_id = ?',
    [numScheduleId]
  );

  if (schedRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Schedule not found', 404);
  }

  const sched = schedRows[0];
  const journeyDateStr = formatIndiaDate(sched.journey_date);

  let mongoDoc = null;
  const db = await getOrConnectMongoDb();
  if (db) {
    mongoDoc = await db.collection('live_train_status').findOne({
      $or: [{ schedule_id: numScheduleId }, { scheduleId: numScheduleId }]
    });
  }

  const status = (mongoDoc && mongoDoc.status) || sched.status || 'ON_TIME';
  const delayMinutes = mongoDoc
    ? (mongoDoc.delayMinutes !== undefined ? Number(mongoDoc.delayMinutes) : Number(mongoDoc.delay_min || 0))
    : Number(sched.delay_minutes || 0);
  const platformNumber = mongoDoc
    ? (mongoDoc.platformNumber !== undefined ? Number(mongoDoc.platformNumber) : Number(mongoDoc.current_platform || 1))
    : 1;

  return {
    scheduleId: numScheduleId,
    trainId: sched.train_id,
    journeyDate: journeyDateStr,
    status,
    delayMinutes,
    platformNumber
  };
}

async function getTrainLiveStatus(trainId) {
  const numTrainId = Number(trainId);
  if (!numTrainId || isNaN(numTrainId)) {
    throw new AppError('VALIDATION_ERROR', 'Valid trainId is required', 400);
  }

  const [trainRows] = await pool.query('SELECT train_id FROM TRAIN WHERE train_id = ?', [numTrainId]);
  if (trainRows.length === 0) {
    throw new AppError('NOT_FOUND', 'Train not found', 404);
  }

  const [schedRows] = await pool.query(
    'SELECT schedule_id FROM TRAIN_SCHEDULE WHERE train_id = ? ORDER BY journey_date DESC, schedule_id DESC LIMIT 1',
    [numTrainId]
  );

  if (schedRows.length === 0) {
    throw new AppError('NOT_FOUND', 'No schedule found for this train', 404);
  }

  return await getScheduleLiveStatus(schedRows[0].schedule_id);
}

module.exports = {
  upsertLiveStatus,
  getScheduleLiveStatus,
  getTrainLiveStatus
};
