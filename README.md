# Quiz Website – Intro CEDT Project

## 📌 Project Description

This project is a **quiz website** developed for the *Intro CEDT* course.
The site allows users to answer quiz questions through a simple web interface built with **HTML, CSS, and JavaScript**. The backend is implemented using **Node.js**, which also integrates with a **Large Language Model (LLM) API** to provide:

* 💡 Hints for quiz questions
* 📖 Explanations to support learning
* 🤖 An interactive Q\&A mode with the AI

The backend securely manages the API key on the server, ensuring safe communication with the LLM. Users only interact with the website, never with the API key directly. The application can be run persistently using **tmux**.

---

## 📂 Project Structure (Temporary)

```
quiz-app/
│── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   └── script.js
│
│── routes/                 # API routes
│   └── hint.js
│
│── controllers/            # Request handling and quiz logic
│   └── quizController.js
│
│── services/               # External API communication
│   └── llmService.js
│
│── server.js               # Main server entry point
│── package.json
│── .env                    # Environment variables (API key, port)
```

---
