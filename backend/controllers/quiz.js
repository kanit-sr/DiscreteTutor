// backend/controllers/quiz.js
const { DATA_DIR } = require('../config');
const { readJSON, shuffle, sanitizeTopic } = require('../utils/fsdb');

function generate(req, res, url) {
  const questions = readJSON(DATA_DIR, 'questions.json', []);
  const topicsParam = (url.searchParams.get('topics') || '')
    .split(',').map(sanitizeTopic).filter(Boolean);
  const n = Math.min(Number(url.searchParams.get('n') || 30), 100);

  let pool = questions;
  if (topicsParam.length) {
    const set = new Set(topicsParam);
    pool = questions.filter(q => set.has(sanitizeTopic(q.topic)));
  }
  const picked = shuffle(pool.slice()).slice(0, Math.min(n, pool.length));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ questions: picked }));
}

module.exports = { generate };
