// backend/controllers/questions.js
const { MONGODB_URI, DATA_DIR } = require('../config');
const { connectToDatabase } = require('../utils/db');
const { readJSON, writeJSON, sanitizeTopic, nextId } = require('../utils/fsdb');

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

async function listQuestions(_req, res) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const docs = await db.collection('questions').find({}).sort({ id: 1 }).toArray();
    // Normalize _id for frontend (ObjectId -> string)
    const normalized = docs.map((doc) => {
      const { _id, ...rest } = doc;
      return { ...rest, _id: _id ? String(_id) : undefined };
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

async function deleteQuestion(_req, res, id) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    const candidates = [];
    if (Number.isFinite(Number(id))) {
      candidates.push({ id: Number(id) }, { id: String(Number(id)) });
    }
    if (ObjectId.isValid(String(id))) {
      candidates.push({ _id: new ObjectId(String(id)) });
    }
    const filter = candidates.length ? { $or: candidates } : { id: -999999 };
    const result = await db.collection('questions').deleteOne(filter);
    if (!result.deletedCount) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Question not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Question deleted successfully' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB delete failed', details: e.message }));
  }
}

async function clearAll(_req, res) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    await db.collection('questions').deleteMany({});
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'All questions cleared successfully' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB clear failed', details: e.message }));
  }
}

async function create(req, res) {
  try {
    const payload = await readBody(req);
    const topic = sanitizeTopic(payload.topic || 'logic');
    const prompt = String(payload.prompt || '').trim();
    const c1 = String(payload.c1 || '').trim();
    const c2 = String(payload.c2 || '').trim();
    const c3 = String(payload.c3 || '').trim();
    const c4 = String(payload.c4 || '').trim();
    const correct = Number(payload.correct);
    if (!prompt || !c1 || !c2 || !c3 || !c4 || ![1,2,3,4].includes(correct)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid question payload' }));
    }
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const last = await db.collection('questions')
      .find({})
      .project({ id: 1 })
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    const next = last.length && typeof last[0].id === 'number' ? last[0].id + 1 : 1;
    const doc = { id: next, topic, prompt, c1, c2, c3, c4, correct };
    await db.collection('questions').insertOne(doc);
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: next, question: doc }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB create failed', details: e.message }));
  }
}

async function update(req, res, id) {
  try {
    const payload = await readBody(req);
    const patch = {};
    if (payload.topic !== undefined) patch.topic = sanitizeTopic(payload.topic);
    if (payload.prompt !== undefined) patch.prompt = String(payload.prompt || '').trim();
    ['c1','c2','c3','c4'].forEach(k => { if (payload[k] !== undefined) patch[k] = String(payload[k] || '').trim(); });
    if (payload.correct !== undefined) patch.correct = Number(payload.correct);
    if ('correct' in patch && ![1,2,3,4].includes(patch.correct)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'correct must be 1..4' }));
    }
    if (!Object.keys(patch).length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'No fields to update' }));
    }
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    const candidates = [];
    if (Number.isFinite(Number(id))) {
      candidates.push({ id: Number(id) }, { id: String(Number(id)) });
    }
    if (ObjectId.isValid(String(id))) {
      candidates.push({ _id: new ObjectId(String(id)) });
    }
    const filter = candidates.length ? { $or: candidates } : { id: -999999 };
    const result = await db.collection('questions').findOneAndUpdate(
      filter,
      { $set: patch },
      { returnDocument: 'after' }
    );
    const updated = result && (Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result);
    if (!updated) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Question not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ question: updated }));
  } catch (e) {
    console.error('updateFlexible error:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB update failed', details: e.message, code: e.code || null }));
  }
}

// Update by id or _id provided in the body (safer when clients have either id form)
async function updateFlexible(req, res) {
  try {
    const payload = await readBody(req);
    const { id, _id } = payload;
    const patch = {};
    if (payload.topic !== undefined) patch.topic = sanitizeTopic(payload.topic);
    if (payload.prompt !== undefined) patch.prompt = String(payload.prompt || '').trim();
    ['c1','c2','c3','c4'].forEach(k => { if (payload[k] !== undefined) patch[k] = String(payload[k] || '').trim(); });
    if (payload.correct !== undefined) patch.correct = Number(payload.correct);
    if ('correct' in patch && ![1,2,3,4].includes(patch.correct)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'correct must be 1..4' }));
    }
    if (!Object.keys(patch).length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'No fields to update' }));
    }
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    const candidates = [];
    if (Number.isFinite(Number(id))) {
      candidates.push({ id: Number(id) }, { id: String(Number(id)) });
    }
    if (typeof _id === 'string' && ObjectId.isValid(_id)) {
      candidates.push({ _id: new ObjectId(_id) });
    }
    if (!candidates.length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Must provide id or _id' }));
    }
    const result = await db.collection('questions').findOneAndUpdate(
      { $or: candidates },
      { $set: patch },
      { returnDocument: 'after' }
    );
    const updated = result && (Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result);
    if (!updated) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Question not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ question: updated }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB update failed', details: e.message }));
  }
}

// Upsert by id or _id: if not found, insert; else update
async function upsert(req, res) {
  try {
    const payload = await readBody(req);
    const { id, _id } = payload;
    const patch = {};
    if (payload.topic !== undefined) patch.topic = sanitizeTopic(payload.topic);
    if (payload.prompt !== undefined) patch.prompt = String(payload.prompt || '').trim();
    ['c1','c2','c3','c4'].forEach(k => { if (payload[k] !== undefined) patch[k] = String(payload[k] || '').trim(); });
    if (payload.correct !== undefined) patch.correct = Number(payload.correct);
    if ('correct' in patch && ![1,2,3,4].includes(patch.correct)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'correct must be 1..4' }));
    }
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const { ObjectId } = require('mongodb');
    const candidates = [];
    if (Number.isFinite(Number(id))) candidates.push({ id: Number(id) }, { id: String(Number(id)) });
    if (typeof _id === 'string' && ObjectId.isValid(_id)) candidates.push({ _id: new ObjectId(_id) });
    if (!candidates.length) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Must provide id or _id' }));
    }
    // Build replacement doc fields if inserting
    const setOnInsert = {};
    if (Number.isFinite(Number(id))) setOnInsert.id = Number(id);
    if (payload.topic !== undefined) setOnInsert.topic = patch.topic;
    if (payload.prompt !== undefined) setOnInsert.prompt = patch.prompt;
    ['c1','c2','c3','c4'].forEach(k => { if (payload[k] !== undefined) setOnInsert[k] = patch[k]; });
    if (payload.correct !== undefined) setOnInsert.correct = patch.correct;

    const result = await db.collection('questions').findOneAndUpdate(
      { $or: candidates },
      { $set: patch, $setOnInsert: setOnInsert },
      { upsert: true, returnDocument: 'after' }
    );
    const updated = result && (Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ question: updated }));
  } catch (e) {
    console.error('upsert error:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'DB upsert failed', details: e.message, code: e.code || null }));
  }
}
async function migrateFromFs(_req, res) {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const existing = await db.collection('questions').estimatedDocumentCount();
    const fileQuestions = readJSON(DATA_DIR, 'questions.json', []);
    if (!Array.isArray(fileQuestions) || !fileQuestions.length) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ migrated: 0, message: 'No questions in filesystem' }));
    }
    let startId = 1;
    if (existing) {
      const last = await db.collection('questions').find({}).project({ id: 1 }).sort({ id: -1 }).limit(1).toArray();
      startId = last.length && typeof last[0].id === 'number' ? last[0].id + 1 : 1;
    }
    let migrated = 0;
    for (const q of fileQuestions) {
      const doc = {
        id: typeof q.id === 'number' ? q.id : startId++,
        topic: sanitizeTopic(q.topic || ''),
        prompt: String(q.prompt || '').trim(),
        c1: String(q.c1 || ''),
        c2: String(q.c2 || ''),
        c3: String(q.c3 || ''),
        c4: String(q.c4 || ''),
        correct: Number(q.correct),
      };
      if (!doc.prompt || !doc.c1 || !doc.c2 || !doc.c3 || !doc.c4 || ![1,2,3,4].includes(doc.correct)) continue;
      await db.collection('questions').updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
      migrated++;
    }
    // Optionally persist normalized file copy
    const normalized = await db.collection('questions').find({}).sort({ id: 1 }).toArray();
    writeJSON(DATA_DIR, 'questions.json', normalized);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ migrated }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Migration failed', details: e.message }));
  }
}

module.exports = { listQuestions, delete: deleteQuestion, clearAll, create, update, updateFlexible, upsert, migrateFromFs };
