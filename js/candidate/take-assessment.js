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

async function renderTakeAssessment(caId, user) {
  try {
    // 1. Fetch assigned assessments to verify ownership and status
    const allCAs = await API.get(`/candidates/${user.candidateId}/assessments`);
    const ca = allCAs.find(a => a.invitationId === caId);

    if (!ca || ca.candidateId !== user.candidateId) {
      document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Assessment not found or not assigned to you.</div>';
      return;
    }
    
    const isCompleted = ca.attempt && ca.attempt.status === 'Completed';
    if (isCompleted) {
      document.getElementById('c-content').innerHTML = `
        <div class="alert alert-info">This assessment has already been submitted.</div>
        <a href="#/portal" class="btn btn-primary mt-12">← Back to Portal</a>`;
      return;
    }

    // 2. Fetch assessment details and questions
    const assessmentData = await API.get(`/assessments/${ca.assessmentId}`);
    if (!assessmentData || !assessmentData.questions || assessmentData.questions.length === 0) {
      document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Assessment data not found. Please contact HR.</div>';
      return;
    }

    // Map to frontend expected structure
    const assessment = {
      id: assessmentData.id,
      title: assessmentData.title,
      duration: parseInt(assessmentData.duration, 10),
      passingScore: parseFloat(assessmentData.passingScore)
    };

    const questions = assessmentData.questions.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      order: q.order,
      options: (q.options || []).map(opt => ({
        id: opt.id,
        text: opt.text,
        scoreValue: opt.scoreValue
      }))
    })).sort((a,b) => (a.order||0) - (b.order||0));

    // 3. Start/resume the attempt via API (idempotent — returns existing In Progress attempt if one exists)
    const attemptSession = sessionStorage.getItem('pa_ta_attempt_' + caId);
    let attemptId;

    if (attemptSession) {
      // Reuse the attempt ID from this browser session
      attemptId = attemptSession;
    } else {
      let startResult;
      try {
        startResult = await API.post(`/assessments/${caId}/start`, {});
      } catch (err) {
        document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Failed to start assessment. Please try again.</div>';
        return;
      }
      attemptId = startResult.attemptId;
      sessionStorage.setItem('pa_ta_attempt_' + caId, attemptId);
      ca.startedAt = startResult.startedAt;
    }

    if (!ca.startedAt) ca.startedAt = new Date().toISOString();

    // Calculate remaining time
    const elapsed  = Math.floor((Date.now() - new Date(ca.startedAt).getTime()) / 1000);
    const total    = assessment.duration * 60;
    const timeLeft = Math.max(0, total - elapsed);
    const attemptIdFinal = attemptId;

  // Restore saved answers from sessionStorage
  const savedAnswers = (() => {
    try { return JSON.parse(sessionStorage.getItem(TA_STORAGE_KEY + caId) || '{}'); }
    catch { return {}; }
  })();

  // Set module state
  _ta = {
    caId, ca, assessment, questions,
    attemptId: attemptIdFinal,
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
  } catch (err) {
    console.error('[TakeAssessment] Load error:', err);
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Failed to load assessment. Please try again.</div>';
  }
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
          <div class="timer-block">
            <div id="timer-display" class="timer-display">${Utils.formatTimer(timeLeft)}</div>
            <div class="text-muted timer-label">Time Remaining</div>
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
          data-oid="${opt.id}"
          data-text="${Utils.esc(opt.text)}"
          data-score="${opt.scoreValue}"
          onclick="handleOptionClick(this)">
        <input type="radio" name="q_${q.id}" value="${Utils.esc(opt.text)}" ${isSelected ? 'checked' : ''} readonly>
        ${Utils.esc(opt.text)}
      </li>`;
  }).join('');

  const typeLabel = q.questionType === 'likert'
    ? '<span class="badge badge-info badge-inline">Likert Scale</span>'
    : '';

  return `
    <div class="question-text">${typeLabel} ${Utils.esc(q.questionText)}</div>
    <ul class="option-list">${optionsHTML}</ul>`;
}

// ── Answer Selection ──────────────────────────────────────────────────────────

/** Called via data-attribute driven click — avoids inline quote issues */
function handleOptionClick(el) {
  const questionId = el.dataset.qid;
  const optionId   = el.dataset.oid;
  const text       = el.dataset.text;
  const scoreValue = Number(el.dataset.score);
  selectOption(questionId, optionId, text, scoreValue, el);
}

async function selectOption(questionId, optionId, text, scoreValue, el) {
  // Save answer locally (temporary session state)
  _ta.answers[questionId] = { selectedAnswer: text, scoreAwarded: scoreValue };
  sessionStorage.setItem(TA_STORAGE_KEY + _ta.caId, JSON.stringify(_ta.answers));

  // Update UI selection immediately for responsiveness
  const card = document.getElementById('question-card');
  card.querySelectorAll('.option-item').forEach(li => li.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input[type="radio"]').checked = true;

  // Update answer count
  const countEl = document.querySelector('.nav-buttons .text-muted');
  if (countEl) countEl.textContent = `${Object.keys(_ta.answers).length} of ${_ta.questions.length} answered`;

  // Sync with API
  const attemptId = _ta.attemptId;
  if (!attemptId) {
    console.warn('[TakeAssessment] No attempt ID found in state.');
    return;
  }

  try {
    await API.post(`/assessments/${attemptId}/responses`, {
      questionId: questionId,
      optionId: optionId
    });
  } catch (err) {
    console.error('[TakeAssessment] Failed to save response via API:', err);
    // Not inventing a large new error UI, just a simple alert if appropriate, or console.
    alert('Failed to save answer to server. Please try again or check your connection.');
  }
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

async function submitAssessment(timedOut = false) {
  if (_ta.submitted) return;
  _ta.submitted = true;

  // Stop timer
  clearInterval(_ta.timerInterval);

  const { caId, assessment, attemptId } = _ta;
  
  if (!attemptId) {
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">No attempt ID found. Please contact support.</div>';
    return;
  }

  try {
    const result = await API.post(`/assessments/${attemptId}/submit`, { timedOut });
    
    // ── Clear session storage ────────────────────────────────────────────────
    sessionStorage.removeItem(TA_STORAGE_KEY + caId);

    // ── Show result screen ────────────────────────────────────────────────────
    const percentage = result.percentageScore || 0;
    const rawPts = result.rawScore || 0;
    const maxPts = result.maxScore || 0;
    const completionTime = result.timeTaken || 0;
    const passFail = percentage >= assessment.passingScore ? 'Pass' : 'Fail';
    
    const icon = passFail === 'Pass' ? '✅' : '❌';
    const resultClass = passFail === 'Pass' ? 'result-pass' : 'result-fail';

    document.getElementById('c-content').innerHTML = `
      <div class="assessment-container">
        <div class="card text-center result-card-wrapper">
          ${timedOut ? '<div class="alert alert-warning" style="margin-bottom:20px;">Time is up! Your assessment was auto-submitted.</div>' : ''}
          <div class="result-icon">${icon}</div>
          <h2 class="result-title">Assessment Submitted</h2>
          <p class="text-muted mb-16">${Utils.esc(assessment.title)}</p>

          <div class="result-card ${resultClass} result-card-inline">
            <div class="result-score">${percentage}%</div>
            <div class="result-label result-label-lg">${passFail}</div>
          </div>

          <div class="result-stats">
            <div class="result-stat"><div class="result-stat-value">${rawPts}/${maxPts}</div><div class="text-muted">Points</div></div>
            <div class="result-stat"><div class="result-stat-value">${Utils.formatDuration(completionTime)}</div><div class="text-muted">Time</div></div>
            <div class="result-stat"><div class="result-stat-value">${assessment.passingScore}%</div><div class="text-muted">Pass Mark</div></div>
          </div>

          <a href="#/portal" class="btn btn-primary mt-16">← Back to Portal</a>
        </div>
      </div>`;
  } catch (err) {
    console.error('[TakeAssessment] Error submitting:', err);
    document.getElementById('c-content').innerHTML = `
      <div class="alert alert-error">Failed to submit assessment: ${err.message || 'Server error'}</div>
      <a href="#/portal" class="btn btn-primary mt-12">← Back to Portal</a>`;
  }
}
