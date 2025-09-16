// backend/utils/db.js
const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedDb && cachedClient) {
    return { client: cachedClient, db: cachedDb };
  }
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  const client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'test';
  const db = client.db(dbName);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

module.exports = { connectToDatabase };


