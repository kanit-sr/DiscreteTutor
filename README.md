# Discrete Math Quiz — v4 (clean split)

## Quick start
```bash
cd backend
cp .env.example .env   # fill OPENAI_API_KEY if you want AI features
npm install
npm start
# open http://localhost:${PORT:-3000}
```

## What’s inside
- **backend/**
  - `server.js` — HTTP server + static file hosting
  - `controllers/` — clean route handlers
    - `questions.js` — list questions
    - `ai.js` — AI explain & AI generate endpoints
    - `quiz.js` — topic-based random quiz
    - `attempts.js` — store & list attempts
  - `utils/fsdb.js` — tiny JSON-file DB helpers
  - `data/questions.json` — seeded from provided file
  - `.env.example` — sample env
- **frontend/**
  - `index.html`, `styles.css`, `app.js` — SPA

## Endpoints
- `GET  /api/questions`
- `POST /api/ai/explain`
- `POST /api/ai/generate-question`
- `GET  /api/quiz/generate?topics=logic,sets&n=30`
- `POST /api/attempts`
- `GET  /api/attempts`

