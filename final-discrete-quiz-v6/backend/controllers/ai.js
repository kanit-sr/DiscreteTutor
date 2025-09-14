// backend/controllers/ai.js
const fetch = require('node-fetch');
const { OPENAI_API_KEY, DATA_DIR } = require('../config');
const { readJSON, writeJSON, nextId, sanitizeTopic } = require('../utils/fsdb');

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

async function explain(req, res) {
  if (!OPENAI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  }
  const payload = await readBody(req);
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a Discrete Math tutor. Explain briefly (3–5 sentences), step by step, clear but concise.' },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body,
    });
    const j = await r.json();
    if (!r.ok || j?.error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: j?.error?.message || `OpenAI error ${r.status}` }));
    }
    const explanation = j?.choices?.[0]?.message?.content || 'No explanation';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ explanation }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'LLM call failed', detail: String(e.message || e) }));
  }
}

async function generateQuestion(req, res) {
  if (!OPENAI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  }
  const payload = await readBody(req);
  const topic = sanitizeTopic(payload.topic || 'logic');
  const prompt = `Create ONE multiple-choice question for an Intro Discrete Math course.
Topic: ${topic}
Return STRICT JSON only in this schema:
{ "topic":"logic|sets|relations|graphs|proof", "prompt":"", "choices":["","","",""], "correct": 1|2|3|4 }`;

  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: 'You write clear 4-choice questions. Keep it short. Avoid verbose text.' },
      { role: 'user', content: prompt },
    ],
  });
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body,
    });
    const j = await r.json();
    if (!r.ok || j?.error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: j?.error?.message || `OpenAI error ${r.status}` }));
    }
    let content = j?.choices?.[0]?.message?.content || '';
    let obj = null;
    try { obj = JSON.parse(content); } catch { 
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { obj = JSON.parse(m[0]); } catch {} }
    }
    if (!obj || !Array.isArray(obj.choices) || ![1,2,3,4].includes(Number(obj.correct))) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'LLM returned invalid format', raw: content }));
    }
    const questions = readJSON(DATA_DIR, 'questions.json', []);
    const id = nextId(questions);
    const rec = {
      id,
      topic: sanitizeTopic(obj.topic || topic),
      prompt: String(obj.prompt || '').trim(),
      c1: String(obj.choices[0] || ''),
      c2: String(obj.choices[1] || ''),
      c3: String(obj.choices[2] || ''),
      c4: String(obj.choices[3] || ''),
      correct: Number(obj.correct),
    };
    questions.push(rec);
    writeJSON(DATA_DIR, 'questions.json', questions);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id, question: rec }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'LLM generate failed', detail: String(e.message || e) }));
  }
}

module.exports = { explain, generateQuestion };
