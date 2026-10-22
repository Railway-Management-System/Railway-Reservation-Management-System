const { MongoClient } = require('mongodb');
const config = require('./env');

let client = null;
let db = null;

async function connectMongo() {
  if (db) return db;
  try {
    client = new MongoClient(config.MONGODB_URI);
    await client.connect();
    db = client.db(config.MONGODB_DB_NAME);
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

function getMongoDb() {
  return db;
}

function getMongoClient() {
  return client;
}

async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectMongo,
  getMongoDb,
  getMongoClient,
  closeMongo
};
