/**
 * Candidate — Profile Page
 * Shows personal info, resume upload, and assessment history.
 */
function renderProfile(user) {
  const candidate = DB.getById(DB.TABLES.CANDIDATES, user.candidateId);
  if (!candidate) {
    document.getElementById('c-content').innerHTML = '<div class="alert alert-error">Profile not found.</div>';
    return;
  }

  const allCAs     = DB.getWhere(DB.TABLES.CANDIDATE_ASSESSMENTS, ca => ca.candidateId === user.candidateId);
  const assessments = DB.get(DB.TABLES.ASSESSMENTS);

  const historyRows = allCAs
    .sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0))
    .map(ca => {
      const assessment = assessments.find(a => a.id === ca.assessmentId);
      return `
        <tr>
          <td>${Utils.esc(assessment?.title || 'Unknown')}</td>
          <td>${Utils.completionBadge(ca.completed)}</td>
          <td>${ca.totalScore != null ? ca.totalScore + '%' : '—'}</td>
          <td>${Utils.passFailBadge(ca.passFail)}</td>
          <td>${ca.completionTime ? Utils.formatDuration(ca.completionTime) : '—'}</td>
          <td>${ca.completedAt ? Utils.formatDate(ca.completedAt) : '—'}</td>
          <td>${Utils.formatDate(ca.assignedAt)}</td>
        </tr>`;
    }).join('');

  document.getElementById('c-content').innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;">My Profile</h2>

    <div id="profile-msg"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <!-- Personal Info -->
      <div class="card">
        <div class="card-title">Personal Information</div>
        <table style="border:none;">
          <tbody>
            <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Name</td><td><strong>${Utils.esc(candidate.name)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td>${Utils.esc(candidate.email)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td>${Utils.statusBadge(candidate.recruitmentStatus)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Applied</td><td>${Utils.formatDate(candidate.appliedAt)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Resume Upload -->
      <div class="card">
        <div class="card-title">Resume</div>
        ${candidate.resumeUrl
          ? `<div class="resume-zone resume-uploaded mb-12">
               <div style="font-size:22px">📄</div>
               <div style="font-weight:600;margin:6px 0;">${Utils.esc(candidate.resumeName || 'Resume')}</div>
               <div class="text-muted">Uploaded</div>
             </div>
             <div class="flex gap-8">
               <a href="${candidate.resumeUrl}" target="_blank" class="btn btn-outline btn-sm" download="${Utils.esc(candidate.resumeName||'resume')}">Download</a>
               <button class="btn btn-secondary btn-sm" onclick="triggerResumeUpload()">Replace</button>
             </div>`
          : `<div class="resume-zone mb-12" onclick="triggerResumeUpload()">
               <div style="font-size:28px;margin-bottom:8px;">📁</div>
               <div style="font-weight:500;">Click to upload resume</div>
               <div class="text-muted mt-8">PDF, DOC, DOCX · Max 2MB</div>
             </div>
             <button class="btn btn-primary w-full" onclick="triggerResumeUpload()">Upload Resume</button>`}

        <input type="file" id="resume-input" accept=".pdf,.doc,.docx" style="display:none"
          onchange="handleResumeUpload(this, '${user.candidateId}')">
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
                   <th>Completed</th>
                   <th>Assigned</th>
                 </tr>
               </thead>
               <tbody>${historyRows}</tbody>
             </table>
           </div>`}
    </div>
  `;
}

function triggerResumeUpload() {
  document.getElementById('resume-input')?.click();
}

function handleResumeUpload(input, candidateId) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    Utils.showMsg('profile-msg', 'File too large. Maximum size is 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    DB.update(DB.TABLES.CANDIDATES, candidateId, {
      resumeUrl:  dataUrl,
      resumeName: file.name
    });
    Utils.showMsg('profile-msg', 'Resume uploaded successfully!', 'success');
    // Re-render profile to show updated state
    const user = Auth.getCurrentUser();
    renderProfile(user);
  };
  reader.onerror = function() {
    Utils.showMsg('profile-msg', 'Failed to read file. Please try again.', 'error');
  };
  reader.readAsDataURL(file);
}
