/**
 * load-mongo.js
 * Loads the 5 seed JSON collections into MongoDB:
 * - live_train_status
 * - notifications
 * - complaints
 * - activity_logs
 * - raw_gateway_replies
 * 
 * Features:
 * - Reads credentials strictly from database/.env
 * - Creates appropriate collections and useful indexes
 * - Safe to re-run: clears and reloads
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/railway_db';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'railway_db';
const SEED_DIR = path.join(__dirname, '..', 'seed-data', 'mongodb');

const COLLECTIONS = [
  'live_train_status',
  'notifications',
  'complaints',
  'activity_logs',
  'raw_gateway_replies'
];

async function loadMongo() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`Connected successfully to MongoDB database: ${MONGODB_DB_NAME}`);
    const db = client.db(MONGODB_DB_NAME);

    const results = {};

    for (const collName of COLLECTIONS) {
      const jsonFile = path.join(SEED_DIR, `${collName}.json`);
      if (!fs.existsSync(jsonFile)) {
        console.warn(`File not found: ${jsonFile}`);
        continue;
      }

      const rawData = fs.readFileSync(jsonFile, 'utf8');
      const docs = JSON.parse(rawData);
      const collection = db.collection(collName);

      // Safe to re-run: clear existing documents
      await collection.deleteMany({});

      // Insert documents if any exist
      if (Array.isArray(docs) && docs.length > 0) {
        // Strip out existing invalid _id if not a standard ObjectId or keep string IDs
        // In seed-data, let's see how they are structured
        const docsToInsert = docs.map(d => {
          const docCopy = { ...d };
          // If _id is a placeholder string like "ObjectId", remove it so mongo generates real ObjectId
          if (docCopy._id === 'ObjectId') {
            delete docCopy._id;
          }
          return docCopy;
        });

        const insertResult = await collection.insertMany(docsToInsert);
        results[collName] = {
          fileCount: docs.length,
          insertedCount: insertResult.insertedCount
        };
      } else {
        results[collName] = { fileCount: 0, insertedCount: 0 };
      }

      console.log(`[MongoDB] ${collName}: ${results[collName].insertedCount} documents loaded.`);
    }

    // Create simple and useful indexes as specified
    console.log('\nCreating indexes...');
    await db.collection('live_train_status').createIndex({ schedule_id: 1, station_id: 1 });
    await db.collection('live_train_status').createIndex({ status: 1 });

    await db.collection('notifications').createIndex({ user_id: 1, sent_at: -1 });
    await db.collection('notifications').createIndex({ is_read: 1 });

    await db.collection('complaints').createIndex({ user_id: 1, created_at: -1 });
    await db.collection('complaints').createIndex({ status: 1 });

    await db.collection('activity_logs').createIndex({ user_id: 1, at: -1 });
    await db.collection('activity_logs').createIndex({ event: 1 });

    await db.collection('raw_gateway_replies').createIndex({ gateway_payment_id: 1 }, { unique: true, sparse: true });

    console.log('Indexes created successfully.');

    // Verify row counts
    console.log('\n--- Final MongoDB Collection Counts ---');
    for (const collName of COLLECTIONS) {
      const count = await db.collection(collName).countDocuments();
      console.log(`${collName}: ${count} (File: ${results[collName].fileCount})`);
    }

    return results;
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

if (require.main === module) {
  loadMongo().catch(err => {
    console.error('MongoDB load failed:', err);
    process.exit(1);
  });
}

module.exports = { loadMongo };
