const crypto = require('crypto');
const { getOrConnectMongoDb } = require('../config/mongodb');
const { formatIndiaDateTime } = require('../utils/dateUtils');
const AppError = require('../utils/appError');
const { ObjectId } = require('mongodb');

function mapNotificationDoc(doc) {
  const defaultTitle = doc.type === 'BOOKING_CONFIRMATION'
    ? 'Booking Confirmation'
    : doc.type === 'DELAY'
    ? 'Train Delay Update'
    : doc.type === 'EMERGENCY'
    ? 'Emergency Incident Alert'
    : 'Booking Status Update';

  return {
    notificationId: String(doc._id),
    userId: Number(doc.user_id !== undefined ? doc.user_id : doc.userId),
    type: doc.type,
    title: doc.title || defaultTitle,
    message: doc.message || '',
    referenceId: doc.reference_id !== undefined ? doc.reference_id : (doc.referenceId || null),
    isRead: doc.is_read !== undefined ? Boolean(doc.is_read) : Boolean(doc.isRead),
    createdAt: formatIndiaDateTime(doc.created_at || doc.sent_at || doc.createdAt)
  };
}

/**
 * Creates an in-app notification in MongoDB.
 * Never throws or bubbles errors to caller (safe for post-commit hooks).
 */
async function createNotification({ userId, type, title, message, referenceId = null }) {
  try {
    const db = await getOrConnectMongoDb();
    if (!db) return null;

    const numUserId = Number(userId);
    const ntfId = `ntf_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();

    const doc = {
      _id: ntfId,
      user_id: numUserId,
      userId: numUserId,
      type,
      title: title || (type === 'BOOKING_CONFIRMATION' ? 'Booking Confirmation' : type),
      message,
      reference_id: referenceId ? String(referenceId) : null,
      referenceId: referenceId ? String(referenceId) : null,
      is_read: false,
      isRead: false,
      sent_at: now,
      created_at: now
    };

    await db.collection('notifications').insertOne(doc);
    return mapNotificationDoc(doc);
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err.message);
    return null;
  }
}

/**
 * Retrieve notifications for the authenticated user, newest first.
 */
async function getUserNotifications(userId) {
  const db = await getOrConnectMongoDb();
  if (!db) return [];

  const numUserId = Number(userId);
  const docs = await db.collection('notifications')
    .find({
      $or: [
        { user_id: numUserId },
        { userId: numUserId }
      ]
    })
    .sort({ sent_at: -1, created_at: -1, _id: -1 })
    .toArray();

  return docs.map(mapNotificationDoc);
}

/**
 * Mark a notification as read (own only).
 */
async function markNotificationRead(id, userId) {
  const db = await getOrConnectMongoDb();
  if (!db) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Database not connected', 500);
  }

  const numUserId = Number(userId);

  // Try finding by string ID first, then ObjectId if valid hex
  let query = { _id: id };
  let doc = await db.collection('notifications').findOne(query);

  if (!doc && ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
    doc = await db.collection('notifications').findOne(query);
  }

  if (!doc) {
    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  const docUserId = Number(doc.user_id !== undefined ? doc.user_id : doc.userId);
  if (docUserId !== numUserId) {
    throw new AppError('FORBIDDEN', 'Access denied: you do not own this notification', 403);
  }

  await db.collection('notifications').updateOne(
    query,
    { $set: { is_read: true, isRead: true } }
  );

  doc.is_read = true;
  doc.isRead = true;
  return mapNotificationDoc(doc);
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  mapNotificationDoc
};
