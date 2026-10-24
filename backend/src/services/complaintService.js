const { getOrConnectMongoDb } = require('../config/mongodb');
const { formatIndiaDateTime } = require('../utils/dateUtils');
const AppError = require('../utils/appError');
const { ObjectId } = require('mongodb');

const VALID_CATEGORIES = [
  'TRAIN_CLEANLINESS',
  'REFUND',
  'STAFF_BEHAVIOR',
  'FOOD_QUALITY',
  'PUNCTUALITY',
  'OTHER'
];

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

function mapComplaintDoc(doc) {
  const extra = doc.extra_fields || {};
  return {
    grievanceId: String(doc._id),
    userId: Number(doc.user_id !== undefined ? doc.user_id : doc.userId),
    category: doc.category || doc.type || 'OTHER',
    subject: doc.subject || extra.subject || '',
    description: doc.description || doc.message || '',
    status: doc.status || 'OPEN',
    response: doc.response !== undefined ? doc.response : (extra.response !== undefined ? extra.response : null),
    createdAt: formatIndiaDateTime(doc.created_at || doc.createdAt)
  };
}

async function createComplaint({ userId, category, subject, description }) {
  const db = await getOrConnectMongoDb();
  if (!db) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Database connection not available', 500);
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw new AppError('VALIDATION_ERROR', `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Subject is required', 400);
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Description is required', 400);
  }

  const numUserId = Number(userId);
  const grievanceId = `cmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const now = new Date();

  const doc = {
    _id: grievanceId,
    user_id: numUserId,
    userId: numUserId,
    type: category, // seed compatibility
    category,
    message: description.trim(), // seed compatibility
    description: description.trim(),
    status: 'OPEN',
    extra_fields: {
      subject: subject.trim(),
      response: null
    },
    subject: subject.trim(),
    response: null,
    created_at: now
  };

  await db.collection('complaints').insertOne(doc);
  return mapComplaintDoc(doc);
}

async function getUserComplaints(userId) {
  const db = await getOrConnectMongoDb();
  if (!db) return [];

  const numUserId = Number(userId);
  const docs = await db.collection('complaints')
    .find({
      $or: [
        { user_id: numUserId },
        { userId: numUserId }
      ]
    })
    .sort({ created_at: -1, _id: -1 })
    .toArray();

  return docs.map(mapComplaintDoc);
}

async function getAdminComplaints({ status = null }) {
  const db = await getOrConnectMongoDb();
  if (!db) return [];

  const query = {};
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError('VALIDATION_ERROR', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    query.status = status;
  }

  const docs = await db.collection('complaints')
    .find(query)
    .sort({ created_at: -1, _id: -1 })
    .toArray();

  return docs.map(mapComplaintDoc);
}

async function updateAdminComplaint(grievanceId, { response, status }) {
  const db = await getOrConnectMongoDb();
  if (!db) {
    throw new AppError('INTERNAL_SERVER_ERROR', 'Database connection not available', 500);
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    throw new AppError('VALIDATION_ERROR', `Status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }

  let query = { _id: grievanceId };
  let doc = await db.collection('complaints').findOne(query);

  if (!doc && ObjectId.isValid(grievanceId)) {
    query = { _id: new ObjectId(grievanceId) };
    doc = await db.collection('complaints').findOne(query);
  }

  if (!doc) {
    throw new AppError('NOT_FOUND', 'Complaint not found', 404);
  }

  const updateFields = {
    status,
    response: response || null,
    'extra_fields.response': response || null,
    updated_at: new Date()
  };

  await db.collection('complaints').updateOne(query, { $set: updateFields });

  const updatedDoc = await db.collection('complaints').findOne(query);
  return mapComplaintDoc(updatedDoc);
}

module.exports = {
  VALID_CATEGORIES,
  VALID_STATUSES,
  createComplaint,
  getUserComplaints,
  getAdminComplaints,
  updateAdminComplaint,
  mapComplaintDoc
};
