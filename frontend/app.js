// frontend/app.js (v5) — with choice cards + toasts
const API = {
  questions: '/api/questions',
  explain: '/api/ai/explain',
  genq: '/api/ai/generate-question',
  quizgen: '/api/quiz/generate',
  attempts: '/api/attempts',
  chat: '/api/ai/chat'
};

// ========== Simple client-side view router ==========
const views = document.querySelectorAll('.view');
document.querySelectorAll('nav button').forEach(btn =>
  btn.onclick = () => showView(btn.dataset.view)
);

function showView(id) {
  views.forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${id}`).classList.remove('hidden');
  if (id === 'questions') loadQuestions();
  if (id === 'take') prepareTakeView();
  if (id === 'attempts') loadAttempts();
}

// ========== Toast system ==========
const toastBox = document.createElement('div');
toastBox.className = 'toast-container';
document.body.appendChild(toastBox);

function toast(msg) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  toastBox.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ========== QUESTIONS ==========
const qAIForm = document.getElementById('q-ai-form');
const qList = document.getElementById('q-list');

qAIForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(qAIForm);
  const topic = (fd.get('topic') || '').trim();
  const btn = qAIForm.querySelector('button');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    const res = await fetch(API.genq, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const out = await res.json();
    if (out?.id) { toast('✅ AI created question #' + out.id); loadQuestions(); }
    else { toast('❌ Error: ' + (out?.error || 'unknown')); }
  } catch (err) {
    toast('⚠️ Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate with AI';
    qAIForm.reset();
  }
});

async function loadQuestions() {
  const res = await fetch(API.questions);
  const items = await res.json();
  qList.innerHTML = items.map(q => `
    <li class="card">
      <div class="question-header">
        <div class="question-content">
          <div><b>[${q.topic}]</b> ${q.prompt}</div>
          <div>1) ${q.c1}<br>2) ${q.c2}<br>3) ${q.c3}<br>4) ${q.c4}</div>
          <div><i>Answer: ${q.correct}</i></div>
        </div>
        <button class="delete-btn" onclick="deleteQuestion(${q.id})" title="Delete question">🗑️</button>
      </div>
    </li>
  `).join('');
  
  // Trigger MathJax rendering for questions list
  if (window.MathJax) {
    MathJax.typesetPromise([qList]);
  }
}

// ========== TAKE QUIZ ==========
const topicsForm = document.getElementById('topics-form');
const topicsBox = document.getElementById('topics-box');
const topicsCount = document.getElementById('topics-count');
const quizDiv = document.getElementById('quiz');
const submitBtn = document.getElementById('submit-quiz');
const resultDiv = document.getElementById('result');

async function prepareTakeView() {
  const res = await fetch(API.questions);
  const items = await res.json();
  const topics = [...new Set(items.map(q => String(q.topic || '').toLowerCase()))].filter(Boolean);
  topicsBox.innerHTML = topics.map(t => `
    <label><input type="checkbox" name="topic" value="${t}"> ${t}</label>
  `).join('') || '<i>No topics available yet</i>';
  quizDiv.innerHTML = '';
  resultDiv.textContent = '';
  submitBtn.classList.add('hidden');
}

topicsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selected = Array.from(topicsBox.querySelectorAll('input[name=topic]:checked')).map(i => i.value);
  const n = Number(topicsCount.value || 30);
  if (!selected.length) { toast('⚠️ Please select at least one topic.'); return; }
  const res = await fetch(`${API.quizgen}?topics=${encodeURIComponent(selected.join(','))}&n=${encodeURIComponent(n)}`);
  const out = await res.json();
  const qarr = out.questions || [];
  if (!qarr.length) {
    quizDiv.innerHTML = '<i>No questions in these topics.</i>';
    submitBtn.classList.add('hidden');
    return;
  }
  renderQuestions(qarr);
});

function renderQuestions(list) {
  quizDiv.innerHTML = list.map((q, i) => {
    const choices = [q.c1, q.c2, q.c3, q.c4].filter(c => c && String(c).trim() !== '');
    const options = choices.map((text, idx) => `
      <label class="choice">
        <input type="radio" name="q${q.id}" value="${idx+1}">
        <span>${String.fromCharCode(65+idx)}. ${text}</span>
      </label>
    `).join('');
    return `
      <section class="q" data-qid="${q.id}">
        <p><b>Q${i + 1}.</b> ${q.prompt}</p>
        <div class="corner-badge" title="Not graded yet">?</div>
        ${options}
        <button class="explain" data-q='${JSON.stringify(q)}'>AI Explain</button>
        <div class="ai"></div>
      </section>
    `;
  }).join('');

  // Trigger MathJax rendering for quiz questions
  if (window.MathJax) {
    MathJax.typesetPromise([quizDiv]);
  }

  // Choice highlighting
  document.querySelectorAll('.choice input').forEach(inp => {
    inp.addEventListener('change', () => {
      document.querySelectorAll(`input[name="${inp.name}"]`).forEach(i =>
        i.closest('.choice').classList.remove('selected')
      );
      inp.closest('.choice').classList.add('selected');
    });
  });

  submitBtn.classList.remove('hidden');
  document.querySelectorAll('.explain').forEach(b => b.onclick = onExplain);
  resultDiv.textContent = '';
}

async function onExplain(ev) {
  const q = JSON.parse(ev.target.dataset.q);
  const sec = ev.target.closest('.q');
  const outDiv = sec.querySelector('.ai');
  outDiv.textContent = 'Thinking...';
  
  try {
    const res = await fetch(API.explain, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q)
    });
    const out = await res.json();
    outDiv.innerHTML = out.explanation || out.error || 'No explanation';
    // Trigger MathJax rendering
    if (window.MathJax) {
      MathJax.typesetPromise([outDiv]);
    }
  } catch (err) {
    outDiv.innerHTML = '⚠️ Network error: ' + err.message;
  }
}

submitBtn?.addEventListener('click', async () => {
  const sections = document.querySelectorAll('.q');
  const answers = [];
  const selectedTopics = Array.from(topicsBox.querySelectorAll('input[name=topic]:checked')).map(i => i.value);
  sections.forEach(sec => {
    const qid = Number(sec.dataset.qid);
    const chosen = Number((sec.querySelector('input[type=radio]:checked') || {}).value);
    answers.push({ question_id: qid, chosen });
  });
  const res = await fetch(API.attempts, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics: selectedTopics, answers })
  });
  const out = await res.json();
  resultDiv.textContent = `Score: ${out.score}/${answers.length} (attempt #${out.attempt_id})`;

  // Colorize by fetching detail
  const detailRes = await fetch('/api/attempts/' + out.attempt_id);
  const detail = await detailRes.json();
  detail.answers.forEach(ans => {
    const sec = document.querySelector(`.q[data-qid="${ans.question_id}"]`);
    if (!sec) return;
    sec.classList.remove('correct','wrong');
    sec.classList.add(ans.correct ? 'correct' : 'wrong');
  });

  loadAttempts();
});

// ========== ATTEMPTS ==========
async function loadAttempts() {
  const res = await fetch('/api/attempts');
  const items = await res.json();
  document.getElementById('attempts').innerHTML = items.map(a => `
    <div class="card attempt-card">
      <div class="attempt-content" onclick="openAttemptDetail(${a.id})">
        <div><b>Attempt #${a.id}</b> — Score ${a.score}/${a.answers.length}</div>
        <div>Topics: ${(a.topics || []).join(', ')}</div>
        <div><small>${a.finished_at}</small></div>
      </div>
      <button class="delete-btn" onclick="deleteAttempt(${a.id})" title="Delete attempt">🗑️</button>
    </div>
  `).join('');
}

// ========== Clear All Buttons ==========
document.getElementById('clear-all-questions')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete ALL questions? This action cannot be undone!')) return;
  
  try {
    const res = await fetch('/api/questions/clear', { method: 'POST' });
    const result = await res.json();
    
    if (res.ok) {
      toast('✅ All questions cleared successfully');
      loadQuestions(); // Refresh the questions list
    } else {
      toast('❌ Error: ' + (result.error || 'Failed to clear questions'));
    }
  } catch (err) {
    toast('⚠️ Network error: ' + err.message);
  }
});

document.getElementById('clear-all-attempts')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete ALL attempts? This action cannot be undone!')) return;
  
  try {
    const res = await fetch('/api/attempts/clear', { method: 'POST' });
    const result = await res.json();
    
    if (res.ok) {
      toast('✅ All attempts cleared successfully');
      loadAttempts(); // Refresh the attempts list
    } else {
      toast('❌ Error: ' + (result.error || 'Failed to clear attempts'));
    }
  } catch (err) {
    toast('⚠️ Network error: ' + err.message);
  }
});

// default view
showView('home');

// ========== Attempt detail modal ==========
const modal = document.getElementById('attempt-modal');
const modalClose = document.getElementById('attempt-close');
const modalBody = document.getElementById('attempt-content');
modalClose?.addEventListener('click', () => modal.style.display = 'none');

async function openAttemptDetail(id) {
  const res = await fetch('/api/attempts/' + id);
  const a = await res.json();
  if (!a || !a.answers) { toast('❌ Attempt not found'); return; }

  const qRes = await fetch(API.questions);
  const questions = await qRes.json();
  const byId = Object.fromEntries(questions.map(q => [q.id, q]));

  modalBody.innerHTML = a.answers.map((ans, i) => {
    const q = byId[ans.question_id] || {};
    const choices = [q.c1, q.c2, q.c3, q.c4].filter(c => c && String(c).trim() !== '');
    const correctIdx = (q.correct ? Number(q.correct) : 0) - 1;
    const chosenIdx = (ans.chosen ? Number(ans.chosen) : 0) - 1;
    const blockClass = ans.correct ? 'q correct' : 'q wrong';
    const opts = choices.map((text, idx) => {
      const mark = idx === correctIdx ? '✅' : (idx === chosenIdx ? '❌' : '');
      return `<div>${String.fromCharCode(65+idx)}. ${text} ${mark}</div>`;
    }).join('');
    return `<section class="${blockClass}"><p><b>Q${i+1}.</b> ${q.prompt || ''}</p>${opts}</section>`;
  }).join('');

  // Trigger MathJax rendering for attempt details
  if (window.MathJax) {
    MathJax.typesetPromise([modalBody]);
  }

  modal.style.display = 'flex';
}

// ========== Theme toggle ==========
const toggleBtn = document.getElementById('theme-toggle');
if (toggleBtn) {
  toggleBtn.onclick = () => {
    document.body.classList.toggle('dark');
    toggleBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  };
}

// ========== Chatbot ==========
const chatbot = document.getElementById('chatbot');
const chatMsgs = document.getElementById('chatbot-messages');
const chatForm = document.getElementById('chatbot-form');
const chatInput = document.getElementById('chatbot-input');
const chatToggle = document.getElementById('chatbot-toggle');
const chatHeader = document.getElementById('chatbot-header');

// collapse/expand
chatToggle.onclick = () => {
  if (chatbot.style.height === '40px') {
    chatbot.style.height = '400px';
    chatToggle.textContent = '_';
  } else {
    chatbot.style.height = '40px';
    chatToggle.textContent = '▢';
  }
};

// Make chatbot draggable
let isDragging = false;
let isResizing = false;
let startX, startY, startWidth, startHeight, startLeft, startTop;

// Header drag functionality
chatHeader.addEventListener('mousedown', (e) => {
  if (e.target === chatToggle) return; // Don't drag when clicking toggle button
  
  isDragging = true;
  chatbot.classList.add('dragging');
  
  const rect = chatbot.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
});

// Resize functionality
chatbot.addEventListener('mousedown', (e) => {
  const rect = chatbot.getBoundingClientRect();
  const isResizeHandle = (
    e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20
  );
  
  if (isResizeHandle) {
    isResizing = true;
    chatbot.classList.add('resizing');
    
    startX = e.clientX;
    startY = e.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  }
});

function handleDrag(e) {
  if (!isDragging) return;
  
  const newLeft = e.clientX - startX;
  const newTop = e.clientY - startY;
  
  // Keep within viewport bounds
  const maxLeft = window.innerWidth - chatbot.offsetWidth;
  const maxTop = window.innerHeight - chatbot.offsetHeight;
  
  chatbot.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
  chatbot.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
  chatbot.style.right = 'auto';
  chatbot.style.bottom = 'auto';
}

function handleResize(e) {
  if (!isResizing) return;
  
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  
  const newWidth = Math.max(250, startWidth + deltaX);
  const newHeight = Math.max(200, startHeight + deltaY);
  
  chatbot.style.width = newWidth + 'px';
  chatbot.style.height = newHeight + 'px';
}

function stopDrag() {
  isDragging = false;
  chatbot.classList.remove('dragging');
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function stopResize() {
  isResizing = false;
  chatbot.classList.remove('resizing');
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

function addMsg(text, who='bot') {
  const div = document.createElement('div');
  div.className = `chat-msg ${who}`;
  div.innerHTML = text;
  chatMsgs.appendChild(div);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  // Trigger MathJax rendering
  if (window.MathJax) {
    MathJax.typesetPromise([div]);
  }
}

chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  addMsg(msg, 'user');
  chatInput.value = '';
  addMsg('Thinking...', 'bot');

  try {
    const res = await fetch(API.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const out = await res.json();
    chatMsgs.lastChild.innerHTML = out.reply || out.error || 'No response';
    // Trigger MathJax rendering for the bot response
    if (window.MathJax) {
      MathJax.typesetPromise([chatMsgs.lastChild]);
    }
  } catch (err) {
    chatMsgs.lastChild.innerHTML = '⚠️ Network error';
  }
};

// ========== Delete Functions ==========
async function deleteQuestion(id) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  
  try {
    const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
    const result = await res.json();
    
    if (res.ok) {
      toast('✅ Question deleted successfully');
      loadQuestions(); // Refresh the questions list
    } else {
      toast('❌ Error: ' + (result.error || 'Failed to delete question'));
    }
  } catch (err) {
    toast('⚠️ Network error: ' + err.message);
  }
}

async function deleteAttempt(id) {
  if (!confirm('Are you sure you want to delete this attempt?')) return;
  
  try {
    const res = await fetch(`/api/attempts/${id}`, { method: 'DELETE' });
    const result = await res.json();
    
    if (res.ok) {
      toast('✅ Attempt deleted successfully');
      loadAttempts(); // Refresh the attempts list
    } else {
      toast('❌ Error: ' + (result.error || 'Failed to delete attempt'));
    }
  } catch (err) {
    toast('⚠️ Network error: ' + err.message);
  }
}
