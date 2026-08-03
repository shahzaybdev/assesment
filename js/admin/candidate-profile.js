/**
 * Admin — Candidate Profile Page
 * Shows candidate info, recruitment status control, resume, assessment history,
 * and assessment assignment.
 */
function renderCandidateProfile(candidateId) {
  const c = DB.getById(DB.TABLES.CANDIDATES, candidateId);
  if (!c) {
    document.getElementById('content').innerHTML = `<div class="alert alert-error">Candidate not found.</div>`;
    return;
  }

  const allCAs      = DB.getWhere(DB.TABLES.CANDIDATE_ASSESSMENTS, ca => ca.candidateId === candidateId);
  const assessments = DB.get(DB.TABLES.ASSESSMENTS);
  const questions   = DB.get(DB.TABLES.QUESTIONS);
  const responses   = DB.get(DB.TABLES.RESPONSES);

  // Build assessment history rows (chronological)
  const historyRows = allCAs
    .sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0))
    .map(ca => {
      const assessment = assessments.find(a => a.id === ca.assessmentId);
      const caResponses = responses.filter(r => r.candidateAssessmentId === ca.id);
      const caQuestions = questions.filter(q => q.assessmentId === ca.assessmentId);
      const maxPts = Utils.maxScore(caQuestions);

      return `
        <tr>
          <td>${Utils.esc(assessment?.title || 'Unknown Assessment')}</td>
          <td>${Utils.completionBadge(ca.completed)}</td>
          <td>${ca.totalScore != null ? ca.totalScore + '%' : '—'}</td>
          <td>${Utils.passFailBadge(ca.passFail)}</td>
          <td>${ca.completionTime ? Utils.formatDuration(ca.completionTime) : '—'}</td>
          <td>${ca.completedAt ? Utils.formatDateTime(ca.completedAt) : '—'}</td>
          <td>${Utils.formatDate(ca.assignedAt)}</td>
          <td>
            ${ca.completed
              ? `<button class="btn btn-sm btn-outline" onclick="showResponses('${ca.id}')">View Responses</button>`
              : `<button class="btn btn-sm btn-danger" onclick="unassignAssessment('${ca.id}','${candidateId}')">Unassign</button>`}
          </td>
        </tr>`;
    }).join('');

  // Assessments available to assign (not yet assigned to this candidate)
  const assignedIds  = allCAs.map(ca => ca.assessmentId);
  const available    = assessments.filter(a => a.status === 'Active' && !assignedIds.includes(a.id));

  const recruitStatuses = ['Applied','Assessment Assigned','Assessment Completed','Interview','Selected','Rejected'];

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2>Candidate Profile</h2>
      <a href="#/dashboard" class="btn btn-outline">← Dashboard</a>
    </div>

    <div id="profile-msg"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- Info -->
      <div class="card">
        <div class="card-title">Personal Information</div>
        <table style="border:none;">
          <tbody>
            <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Name</td><td><strong>${Utils.esc(c.name)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td>${Utils.esc(c.email)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Applied</td><td>${Utils.formatDate(c.appliedAt)}</td></tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Resume</td>
              <td>
                ${c.resumeUrl
                  ? `<a href="${c.resumeUrl}" target="_blank" class="btn btn-sm btn-outline" download="${Utils.esc(c.resumeName||'resume')}">
                      📄 ${Utils.esc(c.resumeName || 'View Resume')}
                     </a>`
                  : '<span class="text-muted">Not uploaded</span>'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Status -->
      <div class="card">
        <div class="card-title">Recruitment Status</div>
        <div class="form-group">
          <label>Current Status</label>
          <select id="recruit-status">
            ${recruitStatuses.map(s => `<option value="${s}" ${c.recruitmentStatus===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="updateRecruitStatus('${candidateId}')">Update Status</button>

        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">

        <div class="card-title">Assign Assessment</div>
        ${available.length === 0
          ? '<p class="text-muted">All active assessments are already assigned, or none exist.</p>'
          : `<div class="flex gap-8">
               <select id="assign-select" style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;">
                 <option value="">Select assessment…</option>
                 ${available.map(a => `<option value="${a.id}">${Utils.esc(a.title)}</option>`).join('')}
               </select>
               <button class="btn btn-success" onclick="assignAssessment('${candidateId}')">Assign</button>
             </div>`}
      </div>
    </div>

    <!-- Assessment History -->
    <div class="card">
      <div class="card-title">Assessment History</div>
      ${allCAs.length === 0
        ? '<p class="empty-state">No assessments assigned yet.</p>'
        : `<div class="table-wrapper">
             <table>
               <thead>
                 <tr>
                   <th>Assessment</th>
                   <th>Status</th>
                   <th>Score</th>
                   <th>Result</th>
                   <th>Time Taken</th>
                   <th>Completed At</th>
                   <th>Assigned At</th>
                   <th>Action</th>
                 </tr>
               </thead>
               <tbody>${historyRows}</tbody>
             </table>
           </div>`}
    </div>

    <!-- Responses Modal placeholder -->
    <div id="responses-modal"></div>
  `;
}

function updateRecruitStatus(candidateId) {
  const status = document.getElementById('recruit-status').value;
  DB.update(DB.TABLES.CANDIDATES, candidateId, { recruitmentStatus: status });
  Utils.showMsg('profile-msg', 'Recruitment status updated.', 'success');
}

function assignAssessment(candidateId) {
  const assessmentId = document.getElementById('assign-select')?.value;
  if (!assessmentId) return Utils.showMsg('profile-msg', 'Please select an assessment.', 'error');

  DB.insert(DB.TABLES.CANDIDATE_ASSESSMENTS, {
    candidateId, assessmentId,
    totalScore: null, passFail: null,
    completed: false, completionTime: null, completedAt: null, startedAt: null,
    assignedAt: new Date().toISOString()
  });

  // Update recruitment status if still at 'Applied'
  const candidate = DB.getById(DB.TABLES.CANDIDATES, candidateId);
  if (candidate && candidate.recruitmentStatus === 'Applied') {
    DB.update(DB.TABLES.CANDIDATES, candidateId, { recruitmentStatus: 'Assessment Assigned' });
  }

  Utils.showMsg('profile-msg', 'Assessment assigned successfully.', 'success');
  renderCandidateProfile(candidateId);
}

function unassignAssessment(caId, candidateId) {
  if (!Utils.confirm('Remove this assessment assignment?')) return;
  DB.delete(DB.TABLES.CANDIDATE_ASSESSMENTS, caId);
  renderCandidateProfile(candidateId);
}

function showResponses(caId) {
  const ca          = DB.getById(DB.TABLES.CANDIDATE_ASSESSMENTS, caId);
  const assessment  = DB.getById(DB.TABLES.ASSESSMENTS, ca.assessmentId);
  const questions   = DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === ca.assessmentId)
                        .sort((a,b) => (a.order||0)-(b.order||0));
  const responses   = DB.getWhere(DB.TABLES.RESPONSES, r => r.candidateAssessmentId === caId);

  const rows = questions.map((q, idx) => {
    const r = responses.find(r => r.questionId === q.id);
    return `
      <tr>
        <td>${idx+1}</td>
        <td>${Utils.esc(q.questionText)}</td>
        <td>${Utils.esc(r?.selectedAnswer || '—')}</td>
        <td>${r ? r.scoreAwarded : '—'} / ${q.scoreValue}</td>
      </tr>`;
  }).join('');

  const modal = `
    <div class="modal-overlay" onclick="this.remove()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Responses — ${Utils.esc(assessment?.title || '')}</h3>
          <button class="modal-close" onclick="document.querySelector('.modal-overlay').remove()">✕</button>
        </div>
        <div class="flex gap-12 mb-12">
          <span>Score: <strong>${ca.totalScore}%</strong></span>
          <span>${Utils.passFailBadge(ca.passFail)}</span>
          <span class="text-muted">Time: ${Utils.formatDuration(ca.completionTime)}</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Score</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.getElementById('responses-modal').innerHTML = modal;
}
