// backend/controllers/quiz.js
const { MONGODB_URI } = require('../config');
const { shuffle, sanitizeTopic, readJSON } = require('../utils/fsdb');
const { connectToDatabase } = require('../utils/db');

async function generate(req, res, url) {
  const topicsParam = (url.searchParams.get('topics') || '')
    .split(',').map(sanitizeTopic).filter(Boolean);
  const n = Math.min(Number(url.searchParams.get('n') || 30), 100);

  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    const filter = topicsParam.length ? { topic: { $in: topicsParam } } : {};
    const questions = await db.collection('questions').find(filter).toArray();
    const pool = questions;
    const picked = shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ questions: picked }));
  } catch (e) {
    // Fallback to fs if Mongo unavailable
    const questions = readJSON(require('path').join(__dirname, '..', 'data'), 'questions.json', []);
    let pool = questions;
    if (topicsParam.length) {
      const set = new Set(topicsParam);
      pool = questions.filter(q => set.has(sanitizeTopic(q.topic)));
    }
    const picked = shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ questions: picked, warning: 'Using filesystem fallback' }));
  }
}

module.exports = { generate };
