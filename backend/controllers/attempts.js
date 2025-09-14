// backend/controllers/attempts.js
const { DATA_DIR } = require('../config');
const { readJSON, writeJSON, nextId } = require('../utils/fsdb');

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
  const questions = readJSON(DATA_DIR, 'questions.json', []);
  const attempts = readJSON(DATA_DIR, 'attempts.json', []);
  const data = await readBody(req);
  const id = nextId(attempts);
  let score = 0;
  const answers = (data.answers || []).map(a => {
    const q = questions.find(qq => qq.id === Number(a.question_id));
    const chosen = Number(a.chosen);
    const correct = q ? (chosen === Number(q.correct) ? 1 : 0) : 0;
    if (correct) score++;
    return { question_id: Number(a.question_id), chosen, correct };
  });
  const rec = {
    id,
    quiz_id: 0,
    topics: Array.isArray(data.topics) ? data.topics : [],
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    score,
    answers,
  };
  attempts.push(rec);
  writeJSON(DATA_DIR, 'attempts.json', attempts);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ attempt_id: id, score }));
}

function list(_req, res) {
  const attempts = readJSON(DATA_DIR, 'attempts.json', []);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(attempts.sort((a,b)=>b.id-a.id)));
}

function read(_req, res, id) {
  const attempts = readJSON(DATA_DIR, 'attempts.json', []);
  const rec = attempts.find(a => a.id === Number(id));
  res.statusCode = rec ? 200 : 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(rec || { error: 'Not found' }));
}
module.exports = { create, list, read };
