// backend/utils/fsdb.js
const fs = require('fs');
const path = require('path');

function readJSON(dir, name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
  catch { return fallback; }
}
function writeJSON(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}
function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sanitizeTopic(s) { return String(s || '').trim().toLowerCase(); }

module.exports = { readJSON, writeJSON, nextId, shuffle, sanitizeTopic };
