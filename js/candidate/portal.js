/**
 * Candidate Portal — Home Page
 * Shows assigned assessments and their status.
 */
async function renderPortal(user) {
  try {
    const candidate = await API.get(`/candidates/${user.candidateId}`);
    if (!candidate) {
      document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Candidate record not found. Please contact HR.</div>';
      return;
    }

    const allCAs = await API.get(`/candidates/${user.candidateId}/assessments`);
    const assessmentsList = await API.get('/assessments');

    const cards = allCAs
      .sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0))
      .map(ca => {
        const assessment = assessmentsList.find(a => a.id === ca.assessmentId);
        if (!assessment) return '';

        const isCompleted = ca.attempt && ca.attempt.status === 'Completed';

        if (isCompleted) {
          const score = parseFloat(ca.attempt.score || 0);
          const passingScore = parseFloat(assessment.passingScore || 0);
          const isPass = score >= passingScore;
          
          const resultClass = isPass ? 'result-pass' : 'result-fail';
          const icon = isPass ? '✅' : '❌';
          
          return `
            <div class="assessment-card">
              <div class="assessment-card-header">
                <div>
                  <div class="assessment-card-title">${Utils.esc(assessment.title)}</div>
                  <div class="assessment-card-meta">Completed</div>
                </div>
                <span class="badge badge-success">Completed</span>
              </div>
              <div class="result-card ${resultClass} mt-12">
                <div class="result-score">${icon} ${score}%</div>
                <div class="result-label">${isPass ? 'Congratulations! You passed.' : 'You did not meet the passing score. Better luck next time.'}</div>
              </div>
            </div>`;
        } else {
          // Pending
          const durationText = `${assessment.duration} minutes`;
          const qCount = assessment.questionCount || 0;
          
          return `
            <div class="assessment-card">
              <div class="assessment-card-header">
                <div>
                  <div class="assessment-card-title">${Utils.esc(assessment.title)}</div>
                  <div class="assessment-card-meta">Duration: ${durationText} · ${qCount} Questions · Passing Score: ${assessment.passingScore}%</div>
                </div>
                <span class="badge badge-warning">Pending</span>
              </div>
              <p style="font-size:13px;color:#374151;margin:10px 0 14px;"></p>
              <button class="btn btn-primary" onclick="startAssessment('${ca.invitationId}')">Start Assessment</button>
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
  } catch (err) {
    console.error(err);
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Failed to load portal data. Please try again.</div>';
  }
}

function startAssessment(caId) {
  Utils.go('#/assessment/' + caId);
}
