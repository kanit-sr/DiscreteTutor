// backend/controllers/attempts.js
const { DATA_DIR, MONGODB_URI } = require('../config');
const { readJSON } = require('../utils/fsdb');
const { connectToDatabase } = require('../utils/db');

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

async function create(req, res) {
  const data = await readBody(req);
  let score = 0;
  let answers = [];
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const ids = (data.answers || []).map(a => Number(a.question_id)).filter(n => Number.isFinite(n));
    const byId = new Map();
    if (ids.length) {
      const docs = await db.collection('questions').find({ id: { $in: ids } }).toArray();
      docs.forEach(q => byId.set(Number(q.id), q));
    }
    answers = (data.answers || []).map(a => {
      const q = byId.get(Number(a.question_id));
      const chosen = Number(a.chosen);
      const correct = q ? (chosen === Number(q.correct) ? 1 : 0) : 0;
      if (correct) score++;
      return { question_id: Number(a.question_id), chosen, correct };
    });
  } catch (e) {
    // Fallback to filesystem if Mongo not available
    const questions = readJSON(DATA_DIR, 'questions.json', []);
    answers = (data.answers || []).map(a => {
      const q = questions.find(qq => qq.id === Number(a.question_id));
      const chosen = Number(a.chosen);
      const correct = q ? (chosen === Number(q.correct) ? 1 : 0) : 0;
      if (correct) score++;
      return { question_id: Number(a.question_id), chosen, correct };
    });
  }
  const rec = {
    quiz_id: 0,
    topics: Array.isArray(data.topics) ? data.topics : [],
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    score,
    answers,
  };
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const result = await db.collection('attempts').insertOne(rec);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ attempt_id: String(result.insertedId), score }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB insert failed', details: e.message }));
  }
}

async function list(_req, res) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const attempts = await db.collection('attempts').find({}).sort({ _id: -1 }).toArray();
    // Normalize MongoDB _id to string id for frontend consumption
    const normalized = attempts.map((doc) => {
      const { _id, ...rest } = doc;
      // Put normalized id LAST so it overrides any legacy id in rest
      return { ...rest, id: String(_id) };
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(normalized));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB list failed', details: e.message }));
  }
}

async function read(_req, res, id) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(id)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid attempt id' }));
    }
    const rec = await db.collection('attempts').findOne({ _id: new ObjectId(id) });
    const body = rec
      ? (() => { const { _id, ...rest } = rec; return { ...rest, id: String(_id) }; })()
      : { error: 'Not found' };
    res.statusCode = rec ? 200 : 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB read failed', details: e.message }));
  }
}

async function deleteAttempt(_req, res, id) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(id)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid attempt id' }));
    }
    const result = await db.collection('attempts').deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Attempt not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Attempt deleted successfully' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB delete failed', details: e.message }));
  }
}

async function clearAll(_req, res) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    await db.collection('attempts').deleteMany({});
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'All attempts cleared successfully' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB clear failed', details: e.message }));
  }
}

module.exports = { create, list, read, delete: deleteAttempt, clearAll };
