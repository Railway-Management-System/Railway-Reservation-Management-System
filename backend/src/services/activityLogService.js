const { getOrConnectMongoDb } = require('../config/mongodb');
const { formatIndiaDateTime } = require('../utils/dateUtils');

function mapActivityLogDoc(doc) {
  return {
    logId: String(doc._id),
    userId: Number(doc.user_id !== undefined ? doc.user_id : doc.userId),
    action: doc.action || doc.event || 'UNKNOWN',
    tableName: doc.tableName || doc.table_name || null,
    recordId: doc.recordId !== undefined ? String(doc.recordId) : (doc.record_id !== undefined ? String(doc.record_id) : null),
    oldValue: doc.oldValue !== undefined ? doc.oldValue : (doc.old_value !== undefined ? doc.old_value : null),
    newValue: doc.newValue !== undefined ? doc.newValue : (doc.new_value !== undefined ? doc.new_value : null),
    loggedAt: formatIndiaDateTime(doc.logged_at || doc.at || doc.loggedAt)
  };
}

/**
 * Writes an activity log entry into MongoDB.
 * Never throws or bubbles errors to caller.
 */
async function logActivity({ userId, action, tableName = null, recordId = null, oldValue = null, newValue = null }) {
  try {
    const db = await getOrConnectMongoDb();
    if (!db) return null;

    const numUserId = Number(userId);
    const logId = `act_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const now = new Date();

    const doc = {
      _id: logId,
      user_id: numUserId,
      userId: numUserId,
      action,
      event: action, // seed compatibility
      table_name: tableName,
      tableName: tableName,
      record_id: recordId ? String(recordId) : null,
      recordId: recordId ? String(recordId) : null,
      old_value: oldValue,
      oldValue: oldValue,
      new_value: newValue,
      newValue: newValue,
      logged_at: now,
      at: now // seed compatibility
    };

    await db.collection('activity_logs').insertOne(doc);
    return mapActivityLogDoc(doc);
  } catch (err) {
    console.error('[ActivityLogService] Error writing activity log:', err.message);
    return null;
  }
}

/**
 * Paged retrieval of activity logs for Admin.
 */
async function getActivityLogs({ page = 1, limit = 50, userId = null, action = null }) {
  const db = await getOrConnectMongoDb();
  if (!db) {
    return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;

  const query = {};
  if (userId) {
    const numUid = Number(userId);
    query.$or = [{ user_id: numUid }, { userId: numUid }];
  }

  if (action) {
    const actionRegex = new RegExp(`^${action}$`, 'i');
    if (query.$or) {
      query.$and = [
        { $or: query.$or },
        { $or: [{ action: actionRegex }, { event: actionRegex }] }
      ];
      delete query.$or;
    } else {
      query.$or = [{ action: actionRegex }, { event: actionRegex }];
    }
  }

  const collection = db.collection('activity_logs');
  const total = await collection.countDocuments(query);
  const docs = await collection
    .find(query)
    .sort({ logged_at: -1, at: -1, _id: -1 })
    .skip(skip)
    .limit(l)
    .toArray();

  return {
    data: docs.map(mapActivityLogDoc),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l) || 1
    }
  };
}

module.exports = {
  logActivity,
  getActivityLogs,
  mapActivityLogDoc
};
