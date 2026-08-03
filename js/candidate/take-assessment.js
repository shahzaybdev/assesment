/**
 * Candidate — Take Assessment
 *
 * Flow:
 *  1. Load CA record → verify ownership + not completed
 *  2. If startedAt not set, set it now
 *  3. Calculate remaining time from startedAt
 *  4. Show one question at a time with timer
 *  5. On submit (or timer expire): score → update DB → redirect to portal
 *
 * Answers are saved to sessionStorage as the candidate progresses.
 */

let _ta = {
  caId:       null,
  ca:         null,
  assessment: null,
  questions:  [],
  answers:    {},   // { questionId: { selectedAnswer, scoreAwarded } }
  current:    0,
  timerInterval: null,
  timeLeft:   0,
  submitted:  false
};

const TA_STORAGE_KEY = 'pa_ta_answers_';

function renderTakeAssessment(caId, user) {
  // Load data
  const ca = DB.getById(DB.TABLES.CANDIDATE_ASSESSMENTS, caId);
  if (!ca || ca.candidateId !== user.candidateId) {
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Assessment not found or not assigned to you.</div>';
    return;
  }
  if (ca.completed) {
    document.getElementById('c-content').innerHTML = `
      <div class="alert alert-info">This assessment has already been submitted.</div>
      <a href="#/portal" class="btn btn-primary mt-12">← Back to Portal</a>`;
    return;
  }

  const assessment = DB.getById(DB.TABLES.ASSESSMENTS, ca.assessmentId);
  const questions  = DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === ca.assessmentId)
                       .sort((a,b) => (a.order||0) - (b.order||0));

  if (!assessment || questions.length === 0) {
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Assessment data not found. Please contact HR.</div>';
    return;
  }

  // Mark start time if first open
  if (!ca.startedAt) {
    DB.update(DB.TABLES.CANDIDATE_ASSESSMENTS, caId, { startedAt: new Date().toISOString() });
    ca.startedAt = new Date().toISOString();
  }

  // Calculate remaining time
  const elapsed  = Math.floor((Date.now() - new Date(ca.startedAt).getTime()) / 1000);
  const total    = assessment.duration * 60;
  const timeLeft = Math.max(0, total - elapsed);

  // Restore saved answers from sessionStorage
  const savedAnswers = (() => {
    try { return JSON.parse(sessionStorage.getItem(TA_STORAGE_KEY + caId) || '{}'); }
    catch { return {}; }
  })();

  // Set module state
  _ta = {
    caId, ca, assessment, questions,
    answers:  savedAnswers,
    current:  0,
    timerInterval: null,
    timeLeft,
    submitted: false
  };

  // Auto-submit if time already up
  if (timeLeft <= 0) {
    submitAssessment();
    return;
  }

  renderAssessmentUI();
  startTimer();
}

// ── UI Rendering ──────────────────────────────────────────────────────────────

function renderAssessmentUI() {
  const { assessment, questions, current, timeLeft } = _ta;
  const q = questions[current];

  document.getElementById('c-content').innerHTML = `
    <div class="assessment-container">
      <!-- Header -->
      <div class="assessment-header">
        <div class="assessment-title-info">
          <h3>${Utils.esc(assessment.title)}</h3>
          <p>Passing score: ${assessment.passingScore}%</p>
        </div>
        <div style="text-align:right">
          <div id="timer-display" class="timer-display">${Utils.formatTimer(timeLeft)}</div>
          <div class="text-muted" style="font-size:11px;margin-top:2px;">Time Remaining</div>
        </div>
      </div>

      <!-- Progress -->
      <div class="progress-info">Question ${current + 1} of ${questions.length}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${((current+1)/questions.length*100).toFixed(1)}%"></div>
      </div>

      <!-- Question Card -->
      <div class="question-card" id="question-card">
        ${renderQuestionCard(q, current)}
      </div>

      <!-- Navigation -->
      <div class="nav-buttons">
        <button class="btn btn-outline" onclick="prevQuestion()" ${current === 0 ? 'disabled' : ''}>← Previous</button>
        <span class="text-muted">${Object.keys(_ta.answers).length} of ${questions.length} answered</span>
        ${current < questions.length - 1
          ? `<button class="btn btn-primary" id="nav-next-btn" onclick="nextQuestion()">Next →</button>`
          : `<button class="btn btn-success" id="nav-next-btn" onclick="confirmSubmit()">Submit Assessment ✓</button>`}
      </div>
    </div>`;
}

function renderQuestionCard(q, idx) {
  const saved = _ta.answers[q.id]?.selectedAnswer;

  // Use data attributes to safely pass option text (avoids quote-escaping issues in onclick)
  const optionsHTML = q.options.map((opt, oi) => {
    const isSelected = saved === opt.text;
    return `
      <li class="option-item ${isSelected ? 'selected' : ''}"
          data-qid="${q.id}"
          data-text="${Utils.esc(opt.text)}"
          data-score="${opt.scoreValue}"
          onclick="handleOptionClick(this)">
        <input type="radio" name="q_${q.id}" value="${Utils.esc(opt.text)}" ${isSelected ? 'checked' : ''} readonly>
        ${Utils.esc(opt.text)}
      </li>`;
  }).join('');

  const typeLabel = q.questionType === 'likert'
    ? '<span class="badge badge-info" style="margin-bottom:10px;display:inline-block;">Likert Scale</span>'
    : '';

  return `
    <div class="question-text">${typeLabel} ${Utils.esc(q.questionText)}</div>
    <ul class="option-list">${optionsHTML}</ul>`;
}

// ── Answer Selection ──────────────────────────────────────────────────────────

/** Called via data-attribute driven click — avoids inline quote issues */
function handleOptionClick(el) {
  const questionId = el.dataset.qid;
  const text       = el.dataset.text;
  const scoreValue = Number(el.dataset.score);
  selectOption(questionId, text, scoreValue, el);
}

function selectOption(questionId, text, scoreValue, el) {
  // Save answer
  _ta.answers[questionId] = { selectedAnswer: text, scoreAwarded: scoreValue };
  sessionStorage.setItem(TA_STORAGE_KEY + _ta.caId, JSON.stringify(_ta.answers));

  // Update UI selection
  const card = document.getElementById('question-card');
  card.querySelectorAll('.option-item').forEach(li => li.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input[type="radio"]').checked = true;

  // Update answer count
  const countEl = document.querySelector('.nav-buttons .text-muted');
  if (countEl) countEl.textContent = `${Object.keys(_ta.answers).length} of ${_ta.questions.length} answered`;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function prevQuestion() {
  if (_ta.current > 0) {
    _ta.current--;
    refreshQuestionCard();
  }
}

function nextQuestion() {
  if (_ta.current < _ta.questions.length - 1) {
    _ta.current++;
    refreshQuestionCard();
  }
}

function refreshQuestionCard() {
  // Re-render question card and nav without destroying timer
  const { questions, current, timeLeft } = _ta;
  const q = questions[current];

  const card = document.getElementById('question-card');
  if (card) card.innerHTML = renderQuestionCard(q, current);

  // Update progress
  const progressInfo = document.querySelector('.progress-info');
  if (progressInfo) progressInfo.textContent = `Question ${current + 1} of ${questions.length}`;

  const progressFill = document.querySelector('.progress-fill');
  if (progressFill) progressFill.style.width = `${((current+1)/questions.length*100).toFixed(1)}%`;

  // Update nav buttons
  const nav = document.querySelector('.nav-buttons');
  if (nav) {
    // Previous button is always first child
    const prevBtn = nav.querySelector('button:first-child');
    if (prevBtn) prevBtn.disabled = current === 0;

    const countEl = nav.querySelector('.text-muted');
    if (countEl) countEl.textContent = `${Object.keys(_ta.answers).length} of ${questions.length} answered`;

    // Replace next/submit button (last button in nav)
    const oldBtn = nav.querySelector('#nav-next-btn');
    if (oldBtn) {
      if (current < questions.length - 1) {
        oldBtn.className = 'btn btn-primary';
        oldBtn.textContent = 'Next →';
        oldBtn.onclick = nextQuestion;
      } else {
        oldBtn.className = 'btn btn-success';
        oldBtn.textContent = 'Submit Assessment ✓';
        oldBtn.onclick = confirmSubmit;
      }
    }
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  _ta.timerInterval = setInterval(() => {
    _ta.timeLeft--;
    const el = document.getElementById('timer-display');
    if (el) {
      el.textContent = Utils.formatTimer(_ta.timeLeft);
      // Reset classes then apply correct warning level
      el.className = 'timer-display';
      if (_ta.timeLeft <= 60)       el.classList.add('danger');
      else if (_ta.timeLeft <= 300) el.classList.add('warn');
    }
    if (_ta.timeLeft <= 0) {
      clearInterval(_ta.timerInterval);
      _ta.timerInterval = null;
      submitAssessment(true);
    }
  }, 1000);
}

// ── Submit ────────────────────────────────────────────────────────────────────

function confirmSubmit() {
  const unanswered = _ta.questions.length - Object.keys(_ta.answers).length;
  const msg = unanswered > 0
    ? `You have ${unanswered} unanswered question(s).\n\nSubmit anyway?`
    : 'Submit your assessment? This cannot be undone.';
  if (!window.confirm(msg)) return;
  submitAssessment(false);
}

function submitAssessment(timedOut = false) {
  if (_ta.submitted) return;
  _ta.submitted = true;

  // Stop timer
  clearInterval(_ta.timerInterval);

  const { caId, ca, assessment, questions, answers } = _ta;

  // ── Calculate score ────────────────────────────────────────────────────────
  const maxPts = Utils.maxScore(questions);
  const rawPts = questions.reduce((sum, q) => sum + (answers[q.id]?.scoreAwarded || 0), 0);
  const percentage = Utils.calcPercentage(rawPts, maxPts);
  const passFail   = percentage >= assessment.passingScore ? 'Pass' : 'Fail';

  // Completion time in seconds
  const startedAt     = ca.startedAt || new Date().toISOString();
  const completionTime = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

  // ── Write Responses ────────────────────────────────────────────────────────
  questions.forEach(q => {
    const ans = answers[q.id] || { selectedAnswer: null, scoreAwarded: 0 };
    DB.insert(DB.TABLES.RESPONSES, {
      candidateAssessmentId: caId,
      questionId: q.id,
      selectedAnswer: ans.selectedAnswer,
      scoreAwarded: ans.scoreAwarded || 0
    });
  });

  // ── Update CandidateAssessment ────────────────────────────────────────────
  DB.update(DB.TABLES.CANDIDATE_ASSESSMENTS, caId, {
    totalScore: percentage,
    passFail,
    completed: true,
    completionTime,
    completedAt: new Date().toISOString()
  });

  // ── Update Candidate status ───────────────────────────────────────────────
  const candidate = DB.getById(DB.TABLES.CANDIDATES, ca.candidateId);
  if (candidate && (candidate.recruitmentStatus === 'Assessment Assigned' || candidate.recruitmentStatus === 'Applied')) {
    DB.update(DB.TABLES.CANDIDATES, ca.candidateId, { recruitmentStatus: 'Assessment Completed' });
  }

  // ── Clear session storage ────────────────────────────────────────────────
  sessionStorage.removeItem(TA_STORAGE_KEY + caId);

  // ── Show result screen ────────────────────────────────────────────────────
  const icon = passFail === 'Pass' ? '✅' : '❌';
  const resultClass = passFail === 'Pass' ? 'result-pass' : 'result-fail';

  document.getElementById('c-content').innerHTML = `
    <div class="assessment-container">
      <div class="card text-center" style="padding:40px">
        ${timedOut ? '<div class="alert alert-warning" style="margin-bottom:20px;">Time is up! Your assessment was auto-submitted.</div>' : ''}
        <div style="font-size:48px;margin-bottom:12px;">${icon}</div>
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">Assessment Submitted</h2>
        <p class="text-muted mb-16">${Utils.esc(assessment.title)}</p>

        <div class="result-card ${resultClass}" style="display:inline-block;padding:24px 48px;margin-bottom:20px;">
          <div class="result-score">${percentage}%</div>
          <div class="result-label" style="font-size:16px;font-weight:600;margin-top:6px;">${passFail}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0;max-width:400px;margin-left:auto;margin-right:auto;">
          <div><div style="font-size:20px;font-weight:700;">${rawPts}/${maxPts}</div><div class="text-muted">Points</div></div>
          <div><div style="font-size:20px;font-weight:700;">${Utils.formatDuration(completionTime)}</div><div class="text-muted">Time</div></div>
          <div><div style="font-size:20px;font-weight:700;">${assessment.passingScore}%</div><div class="text-muted">Pass Mark</div></div>
        </div>

        <a href="#/portal" class="btn btn-primary">← Back to Portal</a>
      </div>
    </div>`;
}
