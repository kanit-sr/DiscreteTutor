// backend/server.js (v4) — clean routing & static server
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { PORT, FRONTEND_DIR, MONGODB_URI, DATA_DIR } = require('./config');
const { connectToDatabase } = require('./utils/db');
const { readJSON } = require('./utils/fsdb');
const Questions = require('./controllers/questions');
const AI = require('./controllers/ai');
const Quiz = require('./controllers/quiz');
const Attempts = require('./controllers/attempts');

function setCORS(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

function serveStatic(urlPath, res) {
  const safe = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(FRONTEND_DIR, path.normalize(safe).replace(/^\+|\/+/g, ''));
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const indexPath = path.join(FRONTEND_DIR, 'index.html');
      return fs.readFile(indexPath, (e2, idx) => {
        if (e2) { res.statusCode = 404; return res.end('Not Found'); }
        res.setHeader('Content-Type', 'text/html'); res.end(idx);
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.end(data);
  });
}

async function initDatabase() {
  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI || MONGODB_URI);
    // Ensure unique index on numeric id
    await db.collection('questions').createIndex({ id: 1 }, { unique: true, name: 'uniq_numeric_id' });
    const count = await db.collection('questions').estimatedDocumentCount();
    if (!count) {
      const seed = readJSON(DATA_DIR, 'questions.json', []);
      if (Array.isArray(seed) && seed.length) {
        const docs = seed
          .filter(q => q && typeof q === 'object')
          .map(q => ({
            id: Number(q.id) || undefined,
            topic: String(q.topic || '').trim().toLowerCase(),
            prompt: String(q.prompt || '').trim(),
            c1: String(q.c1 || ''),
            c2: String(q.c2 || ''),
            c3: String(q.c3 || ''),
            c4: String(q.c4 || ''),
            correct: Number(q.correct) || 0,
          }))
          .filter(q => q.prompt && q.c1 && q.c2 && q.c3 && q.c4 && [1,2,3,4].includes(q.correct));
        // Assign incremental ids if missing
        let next = 1;
        for (const d of docs) { if (!Number.isFinite(d.id)) d.id = next++; else next = Math.max(next, d.id + 1); }
        if (docs.length) {
          await db.collection('questions').insertMany(docs, { ordered: false });
          console.log(`Seeded questions collection with ${docs.length} docs from filesystem.`);
        }
      }
    }
  } catch (e) {
    console.warn('Database initialization skipped/failed:', e.message);
  }
}

// Kick off DB init (non-blocking)
initDatabase();

const server = http.createServer((req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Normalize pathname to avoid trailing slash mismatches (except root)
  let pathname = url.pathname.replace(/\/+$/, '') || '/';

  // API routes
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/questions' && req.method === 'GET') return Questions.listQuestions(req, res);
    if (pathname === '/api/questions' && req.method === 'POST') return Questions.create(req, res);
    if (pathname.startsWith('/api/questions/') && req.method === 'PUT') {
      const id = pathname.split('/').pop();
      return Questions.update(req, res, id);
    }
    if (pathname === '/api/questions/update' && req.method === 'PUT') return Questions.updateFlexible(req, res);
    if (pathname === '/api/questions/clear' && req.method === 'POST') return Questions.clearAll(req, res);
    if (pathname === '/api/questions/migrate' && req.method === 'POST') return Questions.migrateFromFs(req, res);
    if (pathname === '/api/questions/upsert' && req.method === 'PUT') return Questions.upsert(req, res);
    if (pathname.startsWith('/api/questions/') && req.method === 'DELETE') {
      const id = pathname.split('/').pop();
      return Questions.delete(req, res, id);
    }
    if (pathname === '/api/ai/explain' && req.method === 'POST') return AI.explain(req, res);
    if (pathname === '/api/ai/generate-question' && req.method === 'POST') return AI.generateQuestion(req, res);
    if (pathname === '/api/ai/chat' && req.method === 'POST') return AI.chat(req, res);
    if (pathname === '/api/quiz/generate' && req.method === 'GET') return Quiz.generate(req, res, url);
    if (pathname === '/api/attempts' && req.method === 'POST') return Attempts.create(req, res);
    if (pathname === '/api/attempts' && req.method === 'GET') return Attempts.list(req, res);
    if (pathname === '/api/attempts/clear' && req.method === 'POST') return Attempts.clearAll(req, res);
    if (pathname.startsWith('/api/attempts/') && req.method === 'GET') {
      const id = pathname.split('/').pop();
      return Attempts.read(req, res, id);
    }
    if (pathname.startsWith('/api/attempts/') && req.method === 'DELETE') {
      const id = pathname.split('/').pop();
      return Attempts.delete(req, res, id);
    }
    res.statusCode = 404; return res.end(JSON.stringify({ error: 'Not found' }));
  }
  // Static
  return serveStatic(pathname, res);
});

server.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
