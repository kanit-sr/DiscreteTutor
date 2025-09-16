// backend/controllers/ai.js
const fetch = require('node-fetch');
const fs = require('fs');
const { OPENAI_API_KEY, DATA_DIR, MONGODB_URI } = require('../config');
const { readJSON, writeJSON, nextId, sanitizeTopic } = require('../utils/fsdb');
const { connectToDatabase } = require('../utils/db');


// --- Utility: parse JSON from request body ---
async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

// --- Explain a question using OpenAI ---
async function explain(req, res) {
  if (!OPENAI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  }

  const payload = await readBody(req);
  const { prompt, c1, c2, c3, c4, correct } = payload;

  if (!prompt || !c1 || !c2 || !c3 || !c4 || !correct) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing required question fields' }));
  }

  const userContent = `
Explain the following multiple-choice question clearly, step by step, in 3–5 sentences.
Use LaTeX notation for mathematical expressions (e.g., $x^2$, $\\sum_{i=1}^n$, $\\forall x \\in \\mathbb{R}$).
Question: ${prompt}
Choices:
1) ${c1}
2) ${c2}
3) ${c3}
4) ${c4}
Correct answer: ${correct}
`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a Discrete Math tutor. Always use LaTeX notation for mathematical expressions. Use $...$ for inline math and $$...$$ for display math.' },
          { role: 'user', content: userContent },
        ],
      })
    });

    const j = await r.json();
    if (!r.ok || j?.error) {
      console.error('OpenAI explain error:', j);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: j?.error?.message || `OpenAI error ${r.status}` }));
    }

    const explanation = j?.choices?.[0]?.message?.content || 'No explanation';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ explanation }));

  } catch (err) {
    console.error('Explain failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'LLM call failed', detail: String(err.message || err) }));
  }
}

// --- Generate a new multiple-choice question ---
async function generateQuestion(req, res) {
  if (!OPENAI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  }

  // Ensure DATA_DIR exists (legacy fallback if Mongo not set)
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const payload = await readBody(req);
  const topic = sanitizeTopic(payload.topic || 'logic');

  const prompt = `Create ONE multiple-choice question for an Intro Discrete Math course.
Topic: ${topic}
Return STRICT JSON only in this schema:
{ "topic":"logic|sets|relations|graphs|proof", "prompt":"", "choices":["","","",""], "correct": 1|2|3|4 }`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You write clear 4-choice questions. Keep it short.' },
          { role: 'user', content: prompt },
        ]
      })
    });

    const j = await r.json();
    if (!r.ok || j?.error) {
      console.error('OpenAI generate error:', j);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: j?.error?.message || `OpenAI error ${r.status}` }));
    }

    let content = j?.choices?.[0]?.message?.content || '';
    let obj = null;

    try { obj = JSON.parse(content); }
    catch {
      // Try to extract JSON even if AI returned extra text
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { obj = JSON.parse(m[0]); } catch {}
      }
    }

    if (!obj || !Array.isArray(obj.choices) || ![1,2,3,4].includes(Number(obj.correct))) {
      console.error('Invalid question format:', content);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'LLM returned invalid format', raw: content }));
    }

    // Save the new question to MongoDB (primary) and fs (legacy fallback if no Mongo)
    const rec = {
      topic: sanitizeTopic(obj.topic || topic),
      prompt: String(obj.prompt || '').trim(),
      c1: String(obj.choices[0] || ''),
      c2: String(obj.choices[1] || ''),
      c3: String(obj.choices[2] || ''),
      c4: String(obj.choices[3] || ''),
      correct: Number(obj.correct),
    };

    let saved; let id;
    const uri = process.env.MONGODB_URI || MONGODB_URI;
    if (uri) {
      const { db } = await connectToDatabase(uri);
      // Maintain an incremental numeric id for compatibility
      const last = await db.collection('questions')
        .find({})
        .project({ id: 1 })
        .sort({ id: -1 })
        .limit(1)
        .toArray();
      const next = last.length && typeof last[0].id === 'number' ? last[0].id + 1 : 1;
      saved = { ...rec, id: next };
      await db.collection('questions').insertOne(saved);
      id = next;
    } else {
      const questions = readJSON(DATA_DIR, 'questions.json', []);
      id = nextId(questions);
      saved = { ...rec, id };
      questions.push(saved);
      writeJSON(DATA_DIR, 'questions.json', questions);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id, question: saved }));

  } catch (err) {
    console.error('Generate question failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'LLM generate failed', detail: String(err.message || err) }));
  }
}

// --- Chat endpoint for general questions ---
async function chat(req, res) {
  if (!OPENAI_API_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  }

  const payload = await readBody(req);
  const { message } = payload;

  if (!message || !message.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Message is required' }));
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a helpful Discrete Math tutor. Answer questions clearly and concisely using LaTeX notation for mathematical expressions. Use $...$ for inline math and $$...$$ for display math. If the question is not related to discrete mathematics, politely redirect to discrete math topics.' },
          { role: 'user', content: message.trim() },
        ]
      })
    });

    const j = await r.json();
    if (!r.ok || j?.error) {
      console.error('OpenAI chat error:', j);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: j?.error?.message || `OpenAI error ${r.status}` }));
    }

    const reply = j?.choices?.[0]?.message?.content || 'No response';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ reply }));

  } catch (err) {
    console.error('Chat failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Chat failed', detail: String(err.message || err) }));
  }
}

module.exports = { explain, generateQuestion, chat };
