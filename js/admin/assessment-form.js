/**
 * Admin — Assessment Form (Create & Edit)
 * Handles metadata form + dynamic question builder.
 */

let _formQuestions = []; // in-memory list of questions being edited

function renderAssessmentForm(assessmentId) {
  const isEdit = !!assessmentId;
  const a = isEdit ? DB.getById(DB.TABLES.ASSESSMENTS, assessmentId) : null;

  // Load existing questions if editing
  _formQuestions = isEdit
    ? DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === assessmentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(q => ({ ...q, _key: _genKey() }))
    : [];

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2>${isEdit ? 'Edit Assessment' : 'New Assessment'}</h2>
      <a href="#/assessments" class="btn btn-outline">← Back</a>
    </div>

    <div id="form-msg"></div>

    <!-- Metadata -->
    <div class="card">
      <div class="card-title">Assessment Details</div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-title">Assessment Name *</label>
          <input type="text" id="f-title" value="${Utils.esc(a?.title || '')}" placeholder="e.g. Cognitive Aptitude Test">
        </div>
        <div class="form-group">
          <label for="f-status">Status</label>
          <select id="f-status">
            <option value="Active"   ${(!a || a.status==='Active')   ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${a?.status==='Inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="f-description">Description / Instructions</label>
        <textarea id="f-description" rows="3" placeholder="Instructions shown to candidates before they start.">${Utils.esc(a?.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-duration">Duration (minutes) *</label>
          <input type="number" id="f-duration" value="${a?.duration || 30}" min="1" max="300">
        </div>
        <div class="form-group">
          <label for="f-passing">Passing Score (%) *</label>
          <input type="number" id="f-passing" value="${a?.passingScore || 60}" min="1" max="100">
        </div>
      </div>
    </div>

    <!-- Question Builder -->
      <div class="card">
        <div class="flex-between mb-12">
          <div class="card-title card-title-flush">Questions</div>
          <div class="flex gap-8">
            <button class="btn btn-outline btn-sm" onclick="addQuestion('multiple_choice')">+ Multiple Choice</button>
            <button class="btn btn-outline btn-sm" onclick="addQuestion('likert')">+ Likert Scale</button>
          </div>
        </div>
        <div id="question-builder"></div>
        <div id="no-questions" class="empty-state hidden">
          No questions yet. Add a Multiple Choice or Likert Scale question above.
        </div>
      </div>

      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="saveAssessmentForm('${assessmentId || ''}')">
          ${isEdit ? 'Save Changes' : 'Create Assessment'}
        </button>
        <a href="#/assessments" class="btn btn-secondary">Cancel</a>
      </div>
      <div class="spacer"></div>
    `;

  renderQuestionBuilder();
}

// ── Question Builder ──────────────────────────────────────────────────────────

function _genKey() { return Math.random().toString(36).substr(2, 8); }

const LIKERT_OPTIONS = [
  { text: 'Strongly Agree',    scoreValue: 5 },
  { text: 'Agree',             scoreValue: 4 },
  { text: 'Neutral',           scoreValue: 3 },
  { text: 'Disagree',          scoreValue: 2 },
  { text: 'Strongly Disagree', scoreValue: 1 }
];

function addQuestion(type) {
  const q = {
    _key: _genKey(),
    questionText: '',
    questionType: type,
    scoreValue: type === 'likert' ? 5 : 10,
    options: type === 'likert'
      ? [...LIKERT_OPTIONS.map(o => ({...o}))]
      : [
          { text: '', scoreValue: 10 },
          { text: '', scoreValue: 0  },
          { text: '', scoreValue: 0  },
          { text: '', scoreValue: 0  }
        ]
  };
  _formQuestions.push(q);
  renderQuestionBuilder();
  // Scroll to new question
  setTimeout(() => {
    const el = document.querySelector(`[data-qkey="${q._key}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

function removeQuestion(key) {
  _formQuestions = _formQuestions.filter(q => q._key !== key);
  renderQuestionBuilder();
}

function renderQuestionBuilder() {
  const container = document.getElementById('question-builder');
  const noQEl = document.getElementById('no-questions');
  if (!container) return;

  if (_formQuestions.length === 0) {
    container.innerHTML = '';
    if (noQEl) noQEl.style.display = '';
    return;
  }
  if (noQEl) noQEl.style.display = 'none';

  container.innerHTML = _formQuestions.map((q, idx) => renderQuestionItem(q, idx)).join('');
}

function renderQuestionItem(q, idx) {
  const typeLabel = q.questionType === 'likert' ? 'Likert Scale' : 'Multiple Choice';

  const optionsHTML = q.questionType === 'likert'
    ? `<div class="likert-preview">
        Fixed options: <strong>Strongly Agree (5) → Agree (4) → Neutral (3) → Disagree (2) → Strongly Disagree (1)</strong><br>
        <small>Max score for this question:</small>
        <input type="number" value="${q.scoreValue}" min="1" max="100"
          class="form-control form-control-sm score-input"
          onchange="updateQScoreValue('${q._key}', this.value)">
       </div>`
    : `<div>
        <div class="option-header-row">
          <small class="option-label">Option Text</small>
          <small class="option-label">Score</small>
          <small></small>
        </div>
        ${q.options.map((opt, oi) => `
          <div class="option-row">
            <input type="text" value="${Utils.esc(opt.text)}" placeholder="Option ${oi+1} text"
              onchange="updateOption('${q._key}', ${oi}, 'text', this.value)">
            <input type="number" value="${opt.scoreValue}" min="0" max="999"
              title="Score awarded if this option is selected"
              onchange="updateOption('${q._key}', ${oi}, 'scoreValue', +this.value)">
            <button class="btn btn-danger btn-sm btn-icon" onclick="removeOption('${q._key}', ${oi})"
              ${q.options.length <= 2 ? 'disabled' : ''}>✕</button>
          </div>`).join('')}
        <button class="btn btn-outline btn-sm mt-8" onclick="addOption('${q._key}')" ${q.options.length >= 8 ? 'disabled' : ''}>
          + Add Option
        </button>
        <div class="form-hint mt-8">Set the correct option's score (e.g., 10) and wrong options to 0.</div>
       </div>`;

  return `
    <div class="qb-item" data-qkey="${q._key}">
      <div class="qb-header">
        <span class="q-num">Q${idx+1} — ${typeLabel}</span>
        <button class="btn btn-danger btn-sm" onclick="removeQuestion('${q._key}')">Remove</button>
      </div>
      <div class="form-group form-group-sm">
        <label>Question Text *</label>
        <textarea rows="2" class="form-control form-control-sm"
          placeholder="Enter your question…"
          onchange="updateQText('${q._key}', this.value)">${Utils.esc(q.questionText)}</textarea>
      </div>
      ${optionsHTML}
    </div>`;
}

// ── In-memory update helpers (avoid full re-render for each keystroke) ────────

function updateQText(key, val) {
  const q = _formQuestions.find(q => q._key === key);
  if (q) q.questionText = val;
}

function updateQScoreValue(key, val) {
  const q = _formQuestions.find(q => q._key === key);
  if (q) q.scoreValue = Number(val) || 0;
}

function updateOption(key, optIdx, field, val) {
  const q = _formQuestions.find(q => q._key === key);
  if (q && q.options[optIdx] !== undefined) q.options[optIdx][field] = val;
  // Auto-update question scoreValue = max option score
  if (field === 'scoreValue' && q.questionType === 'multiple_choice') {
    q.scoreValue = Math.max(...q.options.map(o => Number(o.scoreValue) || 0));
  }
}

function addOption(key) {
  const q = _formQuestions.find(q => q._key === key);
  if (q && q.options.length < 8) {
    q.options.push({ text: '', scoreValue: 0 });
    renderQuestionBuilder();
  }
}

function removeOption(key, optIdx) {
  const q = _formQuestions.find(q => q._key === key);
  if (q && q.options.length > 2) {
    q.options.splice(optIdx, 1);
    renderQuestionBuilder();
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

function saveAssessmentForm(assessmentId) {
  // Read metadata from DOM
  const title       = document.getElementById('f-title').value.trim();
  const description = document.getElementById('f-description').value.trim();
  const duration    = parseInt(document.getElementById('f-duration').value) || 0;
  const passingScore= parseInt(document.getElementById('f-passing').value) || 0;
  const status      = document.getElementById('f-status').value;

  // Sync text areas (they fire onchange, not oninput)
  _formQuestions.forEach((q, idx) => {
    const el = document.querySelector(`[data-qkey="${q._key}"] textarea`);
    if (el) q.questionText = el.value.trim();
  });

  // Validate metadata
  if (!title)                          return Utils.showMsg('form-msg', 'Assessment name is required.', 'error');
  if (!duration || duration < 1)       return Utils.showMsg('form-msg', 'Duration must be at least 1 minute.', 'error');
  if (!passingScore || passingScore < 1 || passingScore > 100) return Utils.showMsg('form-msg', 'Passing score must be 1–100%.', 'error');
  if (_formQuestions.length === 0)     return Utils.showMsg('form-msg', 'Add at least one question.', 'error');

  // Validate questions
  for (let i = 0; i < _formQuestions.length; i++) {
    const q = _formQuestions[i];
    if (!q.questionText) return Utils.showMsg('form-msg', `Question ${i+1} text is empty.`, 'error');
    if (q.questionType === 'multiple_choice') {
      if (q.options.some(o => !o.text.trim())) return Utils.showMsg('form-msg', `Question ${i+1}: All option texts are required.`, 'error');
      if (!q.options.some(o => o.scoreValue > 0)) return Utils.showMsg('form-msg', `Question ${i+1}: At least one option must have a score > 0.`, 'error');
    }
  }

  const isEdit = !!assessmentId;

  if (isEdit) {
    // Edit still uses localStorage (API edit endpoint not yet implemented)
    DB.update(DB.TABLES.ASSESSMENTS, assessmentId, { title, description, duration, passingScore, status });
    DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === assessmentId)
      .forEach(q => DB.delete(DB.TABLES.QUESTIONS, q.id));
    _formQuestions.forEach((q, idx) => {
      DB.insert(DB.TABLES.QUESTIONS, {
        assessmentId, order: idx + 1,
        questionText: q.questionText, questionType: q.questionType,
        options: q.options, scoreValue: q.scoreValue
      });
    });
    Utils.go('#/assessments');
  } else {
    // CREATE — use backend API
    const payload = {
      title, description, duration, passingScore, status,
      questions: _formQuestions.map(q => ({
        questionText: q.questionText,
        questionType: q.questionType,
        scoreValue:   q.scoreValue,
        options: q.options.slice(0, 4).map(o => ({ text: o.text, scoreValue: o.scoreValue }))
      }))
    };

    API.post('/assessments', payload)
      .then(result => {
        Utils.showMsg('form-msg', `Assessment created! ID: ${result.id}`, 'success');
        setTimeout(() => Utils.go('#/assessments'), 1200);
      })
      .catch(err => {
        Utils.showMsg('form-msg', 'Failed to create assessment: ' + (err.message || 'Server error'), 'error');
      });
  }
}
