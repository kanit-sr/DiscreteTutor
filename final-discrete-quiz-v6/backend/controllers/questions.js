// backend/controllers/questions.js
const { DATA_DIR } = require('../config');
const { readJSON } = require('../utils/fsdb');

function listQuestions(_req, res) {
  const questions = readJSON(DATA_DIR, 'questions.json', []);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(questions));
}

module.exports = { listQuestions };
