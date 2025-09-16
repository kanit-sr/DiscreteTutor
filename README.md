# Discrete Math Quiz — v4 (clean split)

## Quick start
```bash
cd backend
cp .env.example .env   # fill OPENAI_API_KEY if you want AI features
npm install
npm start
# API: http://localhost:${PORT:-3222}
```

## What’s inside
- **backend/**
  - `server.js` — HTTP server + static file hosting
  - `controllers/` — clean route handlers
    - `questions.js` — full CRUD (list, create, update, delete, clear, migrate)
    - `ai.js` — AI explain & AI generate endpoints
    - `quiz.js` — topic-based random quiz
    - `attempts.js` — store & list attempts
  - `utils/fsdb.js` — tiny JSON-file DB helpers
  - `data/questions.json` — seeded from provided file
  - `.env.example` — sample env
- **frontend/**
  - `index.html`, `styles.css`, `app.js` — SPA

## Run frontend locally (port 3221)
```bash
cd frontend
npm start
# open http://localhost:3221
```

## Deploy on EC2 (Ubuntu) with ports 3221 (frontend) and 3222 (backend)
1. SSH to EC2 and install Node LTS
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. Open security group inbound rules for TCP 3221 and 3222.
3. Clone code on instance and install deps
   ```bash
   git clone <your-repo> /home/ubuntu/activity-9
   cd /home/ubuntu/activity-9/backend && npm install
   cd /home/ubuntu/activity-9/frontend && npm install
   ```
4. Environment
   - Backend port defaults to 3222. You can override with `PORT=3222`.
   - Frontend port defaults to 3221. You can override with `FRONTEND_PORT=3221`.
   - Backend supports MongoDB via `MONGODB_URI` (MongoDB Atlas or self-hosted). Example Atlas SRV URI works with MongoDB Compass as well.
   - Optional: `OPENAI_API_KEY` in `/home/ubuntu/activity-9/backend/.env` if needed.
5. Configure environment (MongoDB + ports)
   ```bash
   # Backend env (replace with your real URI)
   echo "MONGODB_URI=<your-mongodb-uri>" | sudo tee -a /home/ubuntu/activity-9/backend/.env
   echo "PORT=3222" | sudo tee -a /home/ubuntu/activity-9/backend/.env

   # Frontend env (optional override)
   echo "FRONTEND_PORT=3221" | sudo tee -a /home/ubuntu/activity-9/frontend/.env
   ```

6. Start services (use tmux, screen, or a process manager like pm2)
   ```bash
   # window 1
   cd /home/ubuntu/activity-9/backend
   npm start

   # window 2
   cd /home/ubuntu/activity-9/frontend
   FRONTEND_PORT=3221 npm start
   ```
7. Access
   - Frontend: http://EC2_PUBLIC_IP:3221
   - Backend API: http://EC2_PUBLIC_IP:3222

### MongoDB & MongoDB Compass
- Backend now supports MongoDB for attempts persistence. Set `MONGODB_URI` in `backend/.env`.
- Verify the same URI in MongoDB Compass to browse the `mydb` database and `attempts` collection.
- If `MONGODB_URI` is not set, the attempts endpoints will fail with 500.

## Endpoints
- `GET  /api/questions` — Read
- `POST /api/questions` — Create
- `PUT  /api/questions/:id` — Update
- `DELETE /api/questions/:id` — Delete
- `POST /api/questions/clear` — Danger: Delete all
- `POST /api/ai/explain`
- `POST /api/ai/generate-question`
- `GET  /api/quiz/generate?topics=logic,sets&n=30`
- `POST /api/attempts` — Create attempt (scores submission)
- `GET  /api/attempts` — Read attempts
- `GET  /api/attempts/:id` — Read attempt detail
- `DELETE /api/attempts/:id` — Delete attempt
- `POST /api/attempts/clear` — Danger: Delete all attempts

## SPA Features
- Questions view supports:
  - Manual create form (with LaTeX support via MathJax)
  - Edit modal (PUT update)
  - Delete per item and Clear All
  - AI generation of a new question (LLM API)
- Take Quiz view:
  - Topic selection, render questions, AI explain per question, submit and score
- Attempts view:
  - List, detail modal, delete per attempt, Clear All
- Global:
  - Tutor chatbot (LLM chat), Dark mode toggle

