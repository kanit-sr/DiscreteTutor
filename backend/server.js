// backend/server.js (v4) — clean routing & static server
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { PORT, FRONTEND_DIR } = require('./config');
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

const server = http.createServer((req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API routes
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/questions' && req.method === 'GET') return Questions.listQuestions(req, res);
    if (url.pathname === '/api/ai/explain' && req.method === 'POST') return AI.explain(req, res);
    if (url.pathname === '/api/ai/generate-question' && req.method === 'POST') return AI.generateQuestion(req, res);
    if (url.pathname === '/api/quiz/generate' && req.method === 'GET') return Quiz.generate(req, res, url);
    if (url.pathname === '/api/attempts' && req.method === 'POST') return Attempts.create(req, res);
    if (url.pathname === '/api/attempts' && req.method === 'GET') return Attempts.list(req, res);
    if (url.pathname.startsWith('/api/attempts/') && req.method === 'GET') {
      const id = url.pathname.split('/').pop();
      return Attempts.read(req, res, id);
    }
    res.statusCode = 404; return res.end(JSON.stringify({ error: 'Not found' }));
  }
  // Static
  return serveStatic(url.pathname, res);
});

server.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
