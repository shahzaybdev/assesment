/**
 * Admin Dashboard — Stats, Funnel, Candidate Table
 */
function renderDashboard() {
  const candidates = DB.get(DB.TABLES.CANDIDATES);
  const allCAs     = DB.get(DB.TABLES.CANDIDATE_ASSESSMENTS);
  const assessments = DB.get(DB.TABLES.ASSESSMENTS);

  // ── Statistics ─────────────────────────────────────────────────────────
  const totalApplicants = candidates.length;
  const assignedIds     = [...new Set(allCAs.map(ca => ca.candidateId))];
  const assigned        = assignedIds.length;
  const completedCAs    = allCAs.filter(ca => ca.completed);
  const completedCount  = completedCAs.length;
  const pending         = allCAs.filter(ca => !ca.completed).length;
  const passed          = completedCAs.filter(ca => ca.passFail === 'Pass').length;
  const failed          = completedCAs.filter(ca => ca.passFail === 'Fail').length;

  const scoredCAs = completedCAs.filter(ca => ca.totalScore != null);
  const avgScore  = scoredCAs.length ? Math.round(scoredCAs.reduce((s, ca) => s + ca.totalScore, 0) / scoredCAs.length) : '—';
  const highest   = scoredCAs.length ? Math.max(...scoredCAs.map(ca => ca.totalScore)) : '—';
  const lowest    = scoredCAs.length ? Math.min(...scoredCAs.map(ca => ca.totalScore)) : '—';

  const timedCAs = completedCAs.filter(ca => ca.completionTime != null);
  const avgTime  = timedCAs.length ? Math.round(timedCAs.reduce((s, ca) => s + ca.completionTime, 0) / timedCAs.length) : null;

  const interviewed = candidates.filter(c => c.recruitmentStatus === 'Interview' || c.recruitmentStatus === 'Selected').length;
  const hired       = candidates.filter(c => c.recruitmentStatus === 'Selected').length;

  // Funnel
  const fApplied    = candidates.length;
  const fAssigned   = allCAs.length;
  const fCompleted  = completedCount;
  const fPassed     = passed;
  const fInterview  = candidates.filter(c => ['Interview','Selected'].includes(c.recruitmentStatus)).length;
  const fSelected   = candidates.filter(c => c.recruitmentStatus === 'Selected').length;

  document.getElementById('content').innerHTML = `
    <div class="page-header"><h2>HR Dashboard</h2></div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${totalApplicants}</div><div class="stat-label">Total Applicants</div></div>
      <div class="stat-card"><div class="stat-value">${assigned}</div><div class="stat-label">Assessment Assigned</div></div>
      <div class="stat-card"><div class="stat-value">${completedCount}</div><div class="stat-label">Completed Assessment</div></div>
      <div class="stat-card"><div class="stat-value">${pending}</div><div class="stat-label">Pending Assessment</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#059669">${passed}</div><div class="stat-label">Passed</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#dc2626">${failed}</div><div class="stat-label">Failed</div></div>
      <div class="stat-card"><div class="stat-value">${typeof avgScore === 'number' ? avgScore + '%' : avgScore}</div><div class="stat-label">Avg Score</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#059669">${typeof highest === 'number' ? highest + '%' : highest}</div><div class="stat-label">Highest Score</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#dc2626">${typeof lowest === 'number' ? lowest + '%' : lowest}</div><div class="stat-label">Lowest Score</div></div>
      <div class="stat-card"><div class="stat-value">${avgTime ? Utils.formatDuration(avgTime) : '—'}</div><div class="stat-label">Avg Completion Time</div></div>
      <div class="stat-card"><div class="stat-value">${interviewed}</div><div class="stat-label">Interview Shortlisted</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#059669">${hired}</div><div class="stat-label">Hired</div></div>
    </div>

    <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start">
      <!-- Funnel -->
      <div class="card">
        <div class="card-title">Recruitment Funnel</div>
        <div class="funnel">
          ${funnelStep(fApplied, 'Applied')}
          <div class="funnel-arrow">↓</div>
          ${funnelStep(fAssigned, 'Assigned')}
          <div class="funnel-arrow">↓</div>
          ${funnelStep(fCompleted, 'Completed')}
          <div class="funnel-arrow">↓</div>
          ${funnelStep(fPassed, 'Passed')}
          <div class="funnel-arrow">↓</div>
          ${funnelStep(fInterview, 'Interview')}
          <div class="funnel-arrow">↓</div>
          ${funnelStep(fSelected, 'Selected')}
        </div>
      </div>

      <!-- Candidate Table -->
      <div class="card">
        <div class="flex-between mb-12">
          <div class="card-title" style="margin:0">Candidates</div>
          <div class="flex gap-8">
            <input type="text" id="dash-search" placeholder="Search name or email…"
              oninput="renderDashboardTable()" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;min-width:200px;">
            <select id="dash-sort" onchange="renderDashboardTable()" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;">
              <option value="">Sort: Default</option>
              <option value="score-high">Score ↓ High</option>
              <option value="score-low">Score ↑ Low</option>
              <option value="status">Recruitment Status</option>
              <option value="completion">Completion Status</option>
            </select>
          </div>
        </div>
        <div id="dash-table"></div>
      </div>
    </div>
  `;

  renderDashboardTable();
}

function funnelStep(count, label) {
  return `<div class="funnel-step"><span class="funnel-count">${count}</span><span class="funnel-label">${label}</span></div>`;
}

function renderDashboardTable() {
  const search = (document.getElementById('dash-search')?.value || '').toLowerCase();
  const sort   = document.getElementById('dash-sort')?.value || '';

  let candidates = DB.get(DB.TABLES.CANDIDATES);
  const allCAs  = DB.get(DB.TABLES.CANDIDATE_ASSESSMENTS);

  // Search
  if (search) {
    candidates = candidates.filter(c =>
      c.name.toLowerCase().includes(search) || (c.email||'').toLowerCase().includes(search)
    );
  }

  // Build rows with assessment data
  let rows = candidates.map(c => {
    const cas    = allCAs.filter(ca => ca.candidateId === c.id);
    const latest = cas.sort((a,b) => new Date(b.assignedAt||0) - new Date(a.assignedAt||0))[0];
    return { c, ca: latest };
  });

  // Sort
  if (sort === 'score-high') rows.sort((a,b) => (b.ca?.totalScore||0) - (a.ca?.totalScore||0));
  if (sort === 'score-low')  rows.sort((a,b) => (a.ca?.totalScore ?? 999) - (b.ca?.totalScore ?? 999));
  if (sort === 'status')     rows.sort((a,b) => (a.c.recruitmentStatus||'').localeCompare(b.c.recruitmentStatus||''));
  if (sort === 'completion') rows.sort((a,b) => {
    const av = a.ca ? (a.ca.completed ? 1 : 0) : -1;
    const bv = b.ca ? (b.ca.completed ? 1 : 0) : -1;
    return bv - av;
  });

  const assessments = DB.get(DB.TABLES.ASSESSMENTS);

  const tableHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Resume</th>
            <th>Recruitment Status</th>
            <th>Assessment</th>
            <th>Score</th>
            <th>Pass/Fail</th>
            <th>Completed</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? '<tr><td colspan="8" class="empty-state">No candidates found.</td></tr>' :
            rows.map(({c, ca}) => {
              const score = ca?.completed && ca?.totalScore != null ? ca.totalScore + '%' : '—';
              const completedDate = ca?.completed ? Utils.formatDate(ca.completedAt) : '—';
              const resumeBtn = c.resumeUrl
                ? `<a href="${c.resumeUrl}" target="_blank" class="btn btn-sm btn-outline" download="${c.resumeName||'resume'}">View</a>`
                : '<span class="text-muted">—</span>';
              return `
                <tr>
                  <td><strong>${Utils.esc(c.name)}</strong><br><span class="text-muted">${Utils.esc(c.email)}</span></td>
                  <td>${resumeBtn}</td>
                  <td>${Utils.statusBadge(c.recruitmentStatus)}</td>
                  <td>${Utils.completionBadge(ca ? ca.completed : undefined)}</td>
                  <td>${score}</td>
                  <td>${Utils.passFailBadge(ca?.passFail)}</td>
                  <td>${completedDate}</td>
                  <td><a href="#/candidates/${c.id}" class="btn btn-sm btn-primary">View</a></td>
                </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>`;

  const el = document.getElementById('dash-table');
  if (el) el.innerHTML = tableHTML;
}
