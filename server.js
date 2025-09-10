// server.js — dependency-free Node backend + static file server
// Run: node server.js (Node 18+)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

function ensureDataDirAndSeed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  const qFile = path.join(DATA_DIR, "questions.json");
  const zFile = path.join(DATA_DIR, "quizzes.json");
  const aFile = path.join(DATA_DIR, "attempts.json");

  if (!fs.existsSync(qFile)) {
    const seedQuestions = [
      {
        id: 1,
        topic: "logic",
        prompt: "Which is equivalent to ¬(P ∧ Q)?",
        c1: "¬P ∧ ¬Q",
        c2: "P → Q",
        c3: "¬P ∨ ¬Q",
        c4: "P ∨ Q",
        correct: 3,
      },
      {
        id: 2,
        topic: "sets",
        prompt: "|A ∪ B| = 10, |A|=7, |B|=6, what is |A ∩ B|?",
        c1: "3",
        c2: "13",
        c3: "1",
        c4: "cannot determine",
        correct: 1,
      },
      {
        id: 3,
        topic: "induction",
        prompt: "Base P(1) true and P(k)→P(k+1) for k≥1 implies?",
        c1: "P(n) holds for all n≥1",
        c2: "P(2) only",
        c3: "Not enough info",
        c4: "False",
        correct: 1,
      },
      {
        id: 4,
        topic: "relations",
        prompt: "A relation that is reflexive and symmetric must be?",
        c1: "An equivalence",
        c2: "Not necessarily transitive",
        c3: "A total order",
        c4: "Anti-symmetric",
        correct: 2,
      },
      {
        id: 5,
        topic: "graphs",
        prompt: "A tree with n vertices has how many edges?",
        c1: "n",
        c2: "n−1",
        c3: "n+1",
        c4: "n(n−1)/2",
        correct: 2,
      },
    ];
    fs.writeFileSync(qFile, JSON.stringify(seedQuestions, null, 2));
  }
  if (!fs.existsSync(zFile)) {
    const seedQuiz = [
      { id: 1, title: "Starter Quiz", question_ids: [1, 2, 3, 4, 5] },
    ];
    fs.writeFileSync(zFile, JSON.stringify(seedQuiz, null, 2));
  }
  if (!fs.existsSync(aFile)) {
    fs.writeFileSync(aFile, JSON.stringify([], null, 2));
  }
}

function readJSON(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}
function nextId(arr) {
  return arr.length ? Math.max(...arr.map((x) => x.id || 0)) + 1 : 1;
}

function sendJSON(res, obj, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function handleAIExplain(req, res) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return sendJSON(res, { error: "Missing OPENAI_API_KEY" }, 500);

  let payload = {};
  try {
    payload = await parseJSONBody(req);
  } catch {
    return sendJSON(res, { error: "Invalid JSON" }, 400);
  }

  const system =
    "You are a Discrete Mathematics tutor. Explain step-by-step, cite definitions, and give a tiny example if helpful. Keep under 200 words.";
  const user = {
    question: payload.question || "",
    choices: payload.choices || [],
    correct_choice: payload.correct ?? null,
    student_choice: payload.chosen ?? null,
  };

  const body = JSON.stringify({
    model: "gpt-4o-mini", // primary
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    temperature: 0.2,
  });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
    });

    const text = await r.text(); // read raw
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {}

    // HANDLE NON-200 + API error payloads
    if (!r.ok || data?.error) {
      // Optional: fall back to a different model if allowed
      if (r.status === 404 || (data?.error?.message || "").includes("model")) {
        const fallback = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ ...JSON.parse(body), model: "gpt-4o" }),
          }
        );
        const fbData = await fallback.json();
        if (!fallback.ok || fbData?.error) {
          return sendJSON(
            res,
            {
              error:
                fbData?.error?.message || `OpenAI error ${fallback.status}`,
            },
            500
          );
        }
        const explanationFB =
          fbData?.choices?.[0]?.message?.content || "No response";
        return sendJSON(res, { explanation: explanationFB });
      }
      return sendJSON(
        res,
        {
          error: data?.error?.message || `OpenAI error ${r.status}`,
          detail: text,
        },
        500
      );
    }

    const explanation = data?.choices?.[0]?.message?.content || "No response";
    return sendJSON(res, { explanation });
  } catch (e) {
    return sendJSON(res, { error: "LLM call failed", detail: e.message }, 500);
  }
}

function serveStatic(urlPath, res) {
  let safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(
    PUBLIC_DIR,
    path.normalize(safePath).replace(/^\\|\/+/, "")
  );
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end("Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
    };
    res.setHeader("Content-Type", types[ext] || "text/plain");
    res.end(data);
  });
}

function routeAPI(req, res, url) {
  // Data snapshots per request
  let questions = readJSON("questions.json", []);
  let quizzes = readJSON("quizzes.json", []);
  let attempts = readJSON("attempts.json", []);

  // /api/questions and /api/questions/:id
  if (url.pathname === "/api/questions") {
    if (req.method === "GET") return sendJSON(res, questions);
    if (req.method === "POST") {
      parseJSONBody(req)
        .then((data) => {
          const id = nextId(questions);
          const q = {
            id,
            topic: data.topic,
            prompt: data.prompt,
            c1: data.c1,
            c2: data.c2,
            c3: data.c3,
            c4: data.c4,
            correct: Number(data.correct),
          };
          questions.push(q);
          writeJSON("questions.json", questions);
          sendJSON(res, { id });
        })
        .catch(() => sendJSON(res, { error: "Invalid JSON" }, 400));
      return;
    }
  }
  if (url.pathname.startsWith("/api/questions/")) {
    const id = Number(url.pathname.split("/").pop());
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);

    if (req.method === "GET") return sendJSON(res, questions[idx]);
    if (req.method === "PUT") {
      parseJSONBody(req)
        .then((data) => {
          questions[idx] = {
            ...questions[idx],
            ...data,
            id,
            correct: Number(data.correct ?? questions[idx].correct),
          };
          writeJSON("questions.json", questions);
          sendJSON(res, { ok: true });
        })
        .catch(() => sendJSON(res, { error: "Invalid JSON" }, 400));
      return;
    }
    if (req.method === "DELETE") {
      questions.splice(idx, 1);
      writeJSON("questions.json", questions);
      return sendJSON(res, { ok: true });
    }
  }

  // /api/quizzes and /api/quizzes/:id
  if (url.pathname === "/api/quizzes") {
    if (req.method === "GET") return sendJSON(res, quizzes);
    if (req.method === "POST") {
      parseJSONBody(req)
        .then((data) => {
          const id = nextId(quizzes);
          const quiz = {
            id,
            title: data.title,
            question_ids: (data.question_ids || []).map(Number),
          };
          quizzes.push(quiz);
          writeJSON("quizzes.json", quizzes);
          sendJSON(res, { id });
        })
        .catch(() => sendJSON(res, { error: "Invalid JSON" }, 400));
      return;
    }
  }
  if (url.pathname.startsWith("/api/quizzes/")) {
    const id = Number(url.pathname.split("/").pop());
    const quiz = quizzes.find((z) => z.id === id);
    if (!quiz) return sendJSON(res, { error: "Not found" }, 404);

    if (req.method === "GET") {
      if (url.searchParams.get("with") === "questions") {
        const items = quiz.question_ids
          .map((qid) => questions.find((q) => q.id === qid))
          .filter(Boolean);
        return sendJSON(res, { ...quiz, questions: items });
      }
      return sendJSON(res, quiz);
    }
    if (req.method === "PUT") {
      parseJSONBody(req)
        .then((data) => {
          quiz.title = data.title ?? quiz.title;
          if (Array.isArray(data.question_ids))
            quiz.question_ids = data.question_ids.map(Number);
          writeJSON("quizzes.json", quizzes);
          sendJSON(res, { ok: true });
        })
        .catch(() => sendJSON(res, { error: "Invalid JSON" }, 400));
      return;
    }
    if (req.method === "DELETE") {
      const idx = quizzes.findIndex((z) => z.id === id);
      quizzes.splice(idx, 1);
      writeJSON("quizzes.json", quizzes);
      return sendJSON(res, { ok: true });
    }
  }

  // /api/attempts and /api/attempts/:id
  if (url.pathname === "/api/attempts" && req.method === "POST") {
    parseJSONBody(req)
      .then((data) => {
        const attempt_id = nextId(attempts);
        const started = new Date().toISOString();
        let score = 0;
        const answers = (data.answers || []).map((a) => {
          const q = questions.find((qq) => qq.id === Number(a.question_id));
          const chosen = Number(a.chosen);
          const correct = q ? (chosen === Number(q.correct) ? 1 : 0) : 0;
          if (correct) score++;
          return { question_id: Number(a.question_id), chosen, correct };
        });
        const rec = {
          id: attempt_id,
          quiz_id: Number(data.quiz_id || 0),
          started_at: started,
          finished_at: new Date().toISOString(),
          score,
          answers,
        };
        attempts.push(rec);
        writeJSON("attempts.json", attempts);
        sendJSON(res, { attempt_id, score });
      })
      .catch(() => sendJSON(res, { error: "Invalid JSON" }, 400));
    return;
  }
  if (url.pathname.startsWith("/api/attempts/")) {
    const id = Number(url.pathname.split("/").pop());
    const rec = attempts.find((a) => a.id === id);
    if (!rec) return sendJSON(res, { error: "Not found" }, 404);
    return sendJSON(res, rec);
  }

  // /api/ai/explain
  if (url.pathname === "/api/ai/explain" && req.method === "POST") {
    return handleAIExplain(req, res);
  }

  return sendJSON(res, { error: "Not found" }, 404);
}

ensureDataDirAndSeed();

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) return routeAPI(req, res, url);
  return serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Quiz server running at http://localhost:${PORT}`);
});
