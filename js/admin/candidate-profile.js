/**
 * Admin — Candidate Profile Page
 * Shows candidate info, recruitment status control, resume, assessment history,
 * and assessment assignment.
 */
async function renderCandidateProfile(candidateId) {
  let c = DB.getById(DB.TABLES.CANDIDATES, candidateId);
  if (!c) {
    try {
      c = await API.get(`/candidates/${encodeURIComponent(candidateId)}`);
    } catch (err) {
      console.error('Failed to load candidate from API:', err);
    }
  }
  if (!c) {
    document.getElementById('content').innerHTML = `<div class="alert alert-error">Candidate not found.</div>`;
    return;
  }

  let allCAs = [];
  try {
    allCAs = await API.get(`/candidates/${encodeURIComponent(candidateId)}/assessments`);
  } catch (err) {
    console.error('Failed to load assessments from API:', err);
  }

  let assessments = [];
  try {
    assessments = await API.get('/assessments');
  } catch (err) {
    console.error('Failed to load assessments list from API:', err);
  }

  const questions   = DB.get(DB.TABLES.QUESTIONS);
  const responses   = DB.get(DB.TABLES.RESPONSES);

  // Build assessment history rows (chronological)
  const historyRows = allCAs
    .sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0))
    .map(ca => {
      const assessment = assessments.find(a => a.id === ca.assessmentId);
      const attempt = ca.attempt;

      const isCompleted = ca.status === 'Completed' || attempt?.status === 'Completed';
      const numericScore = isCompleted && attempt?.score != null ? parseFloat(attempt.score) : null;
      const passingPct = ca.passingPercentage != null ? parseFloat(ca.passingPercentage) : null;
      const passFail = isCompleted && numericScore != null && passingPct != null
        ? (numericScore >= passingPct ? 'Pass' : 'Fail')
        : null;

      let statusText = 'Assigned';
      if (ca.status === 'Completed' || attempt?.status === 'Completed') {
        statusText = 'Completed';
      } else if (attempt?.status === 'In Progress') {
        statusText = 'In Progress';
      } else if (ca.status === 'Expired') {
        statusText = 'Expired';
      }

      const score = numericScore != null ? `${numericScore}%` : '—';
      const timeTaken = attempt?.timeTakenSeconds != null ? Utils.formatDuration(attempt.timeTakenSeconds) : '—';
      const completedAt = attempt?.submittedAt ? Utils.formatDateTime(attempt.submittedAt) : '—';
      const assignedAt = ca.assignedAt ? Utils.formatDate(ca.assignedAt) : '—';

      return `
        <tr>
          <td>${Utils.esc(assessment?.title || ca.title || 'Unknown Assessment')}</td>
          <td>${Utils.esc(statusText)}</td>
          <td>${score}</td>
          <td>${passFail ? Utils.passFailBadge(passFail) : '—'}</td>
          <td>${timeTaken}</td>
          <td>${completedAt}</td>
          <td>${assignedAt}</td>
          <td>
            ${statusText === 'Completed'
              ? `<button class="btn btn-sm btn-outline" onclick="showResponses('${ca.invitationId}')">View Responses</button>`
              : `<button class="btn btn-sm btn-danger" onclick="unassignAssessment('${ca.assessmentId}','${candidateId}')">Unassign</button>`}
          </td>
        </tr>`;
    }).join('');

  // Assessments available to assign (show all active assessments)
  const available = assessments.filter(a => a.status === 'Active');

  const recruitStatuses = ['Applied','Assessment Assigned','Assessment Completed','Interview','Selected','Rejected'];

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2>Candidate Profile</h2>
      <a href="#/dashboard" class="btn btn-outline">← Dashboard</a>
    </div>

    <div id="profile-msg"></div>

    <div class="grid-2">
      <!-- Info -->
      <div class="card">
        <div class="card-title">Personal Information</div>
        <table class="table-flush">
          <tbody>
            <tr><td class="table-label">Name</td><td><strong>${Utils.esc(c.name)}</strong></td></tr>
            <tr><td class="table-label">Email</td><td>${Utils.esc(c.email)}</td></tr>
            <tr><td class="table-label">Applied</td><td>${Utils.formatDate(c.appliedAt)}</td></tr>
            <tr>
              <td class="table-label">Resume</td>
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

        <hr class="divider-hr">

        <div class="card-title">Assign Assessment</div>
        ${available.length === 0
          ? '<p class="text-muted">All active assessments are already assigned, or none exist.</p>'
          : `<div class="flex gap-8">
               <select id="assign-select" class="form-control form-control-sm" style="flex:1">
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

async function updateRecruitStatus(candidateId) {
  const status = document.getElementById('recruit-status').value;

  try {
    await API.patch(`/candidates/${encodeURIComponent(candidateId)}/recruitment-status`, { status });
    Utils.showMsg('profile-msg', 'Recruitment status updated.', 'success');
  } catch (err) {
    console.error('Failed to update recruitment status:', err);
    Utils.showMsg('profile-msg', 'Failed to update status: ' + (err.message || 'Server error'), 'error');
    return;
  }

  if (apiCandidates) {
    const idx = apiCandidates.findIndex(c => c.id === candidateId);
    if (idx !== -1) {
      apiCandidates[idx].recruitmentStatus = status;
    }
  }

  renderDashboardTable();
}

async function assignAssessment(candidateId) {
  const assessmentId = document.getElementById('assign-select')?.value;
  if (!assessmentId) return Utils.showMsg('profile-msg', 'Please select an assessment.', 'error');

  try {
    await API.post(`/candidates/${encodeURIComponent(candidateId)}/assessments`, { assessmentId });
    Utils.showMsg('profile-msg', 'Assessment assigned successfully.', 'success');
  } catch (err) {
    console.error('Failed to assign assessment:', err);
    Utils.showMsg('profile-msg', 'Failed to assign assessment: ' + (err.message || 'Server error'), 'error');
    return;
  }

  if (apiCandidates) {
    try {
      apiAssessments[candidateId] = await API.get(`/candidates/${encodeURIComponent(candidateId)}/assessments`);
    } catch (e) {
      apiAssessments[candidateId] = [];
    }
  }

  await renderCandidateProfile(candidateId);
}

async function unassignAssessment(assessmentId, candidateId) {
  if (!Utils.confirm('Remove this assessment assignment?')) return;
  const allCAs = DB.getWhere(DB.TABLES.CANDIDATE_ASSESSMENTS, ca => ca.candidateId === candidateId && ca.assessmentId === assessmentId);
  allCAs.forEach(ca => DB.delete(DB.TABLES.CANDIDATE_ASSESSMENTS, ca.id));
  await renderCandidateProfile(candidateId);
}

function showResponses(caId) {
  const ca = DB.getById(DB.TABLES.CANDIDATE_ASSESSMENTS, caId);
  if (!ca) {
    document.getElementById('responses-modal').innerHTML = `
      <div class="modal-overlay" onclick="this.remove()">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>Responses</h3>
            <button class="modal-close" onclick="document.querySelector('.modal-overlay').remove()">✕</button>
          </div>
          <p class="text-muted">Response details are not available for this assessment in the current view.</p>
        </div>
      </div>`;
    return;
  }

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
