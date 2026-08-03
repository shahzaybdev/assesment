/**
 * Candidate Portal — Home Page
 * Shows assigned assessments and their status.
 */
function renderPortal(user) {
  const candidate = DB.getById(DB.TABLES.CANDIDATES, user.candidateId);
  if (!candidate) {
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Candidate record not found. Please contact HR.</div>';
    return;
  }

  const allCAs     = DB.getWhere(DB.TABLES.CANDIDATE_ASSESSMENTS, ca => ca.candidateId === user.candidateId);
  const assessments = DB.get(DB.TABLES.ASSESSMENTS);

  const cards = allCAs
    .sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0))
    .map(ca => {
      const assessment = assessments.find(a => a.id === ca.assessmentId);
      if (!assessment) return '';

      if (ca.completed) {
        // Show result
        const resultClass = ca.passFail === 'Pass' ? 'result-pass' : 'result-fail';
        const icon = ca.passFail === 'Pass' ? '✅' : '❌';
        return `
          <div class="assessment-card">
            <div class="assessment-card-header">
              <div>
                <div class="assessment-card-title">${Utils.esc(assessment.title)}</div>
                <div class="assessment-card-meta">Completed ${Utils.formatDateTime(ca.completedAt)} · Time taken: ${Utils.formatDuration(ca.completionTime)}</div>
              </div>
              <span class="badge badge-success">Completed</span>
            </div>
            <div class="result-card ${resultClass} mt-12">
              <div class="result-score">${icon} ${ca.totalScore}%</div>
              <div class="result-label">${ca.passFail === 'Pass' ? 'Congratulations! You passed.' : 'You did not meet the passing score. Better luck next time.'}</div>
            </div>
          </div>`;
      } else {
        // Show start button
        const durationText = `${assessment.duration} minutes`;
        const qCount = DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === assessment.id).length;
        return `
          <div class="assessment-card">
            <div class="assessment-card-header">
              <div>
                <div class="assessment-card-title">${Utils.esc(assessment.title)}</div>
                <div class="assessment-card-meta">Duration: ${durationText} · ${qCount} Questions · Passing Score: ${assessment.passingScore}%</div>
              </div>
              <span class="badge badge-warning">Pending</span>
            </div>
            <p style="font-size:13px;color:#374151;margin:10px 0 14px;">${Utils.esc(assessment.description)}</p>
            <button class="btn btn-primary" onclick="startAssessment('${ca.id}')">Start Assessment</button>
          </div>`;
      }
    }).join('');

  document.getElementById('c-content').innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:4px;">Welcome, ${Utils.esc(candidate.name)}</h2>
    <p class="text-muted mb-16">Status: ${Utils.statusBadge(candidate.recruitmentStatus)}</p>

    <h3 style="font-size:14px;font-weight:600;color:#374151;margin-bottom:10px;">Your Assessments</h3>

    ${allCAs.length === 0
      ? `<div class="card text-center" style="padding:40px;color:#9ca3af;">
           No assessments assigned yet. Please check back later.
         </div>`
      : cards}
  `;
}

function startAssessment(caId) {
  Utils.go('#/assessment/' + caId);
}
