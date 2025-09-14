// backend/controllers/questions.js
const { DATA_DIR } = require('../config');
const { readJSON, writeJSON } = require('../utils/fsdb');

function listQuestions(_req, res) {
  const questions = readJSON(DATA_DIR, 'questions.json', []);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(questions));
}

function deleteQuestion(_req, res, id) {
  const questions = readJSON(DATA_DIR, 'questions.json', []);
  const index = questions.findIndex(q => q.id === Number(id));
  
  if (index === -1) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Question not found' }));
  }
  
  questions.splice(index, 1);
  writeJSON(DATA_DIR, 'questions.json', questions);
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: 'Question deleted successfully' }));
}

function clearAll(_req, res) {
  writeJSON(DATA_DIR, 'questions.json', []);
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: 'All questions cleared successfully' }));
}

module.exports = { listQuestions, delete: deleteQuestion, clearAll };
