/**
 * Admin — Assessment Management List Page
 */
async function renderAssessments() {
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2>Assessments</h2>
      <a href="#/assessments/new" class="btn btn-primary">+ New Assessment</a>
    </div>
    <div id="assess-msg"></div>
    <div class="card card-flush">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Assessment Name</th>
              <th>Questions</th>
              <th>Duration</th>
              <th>Passing Score</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="assessments-tbody">
            <tr><td colspan="7" class="empty-state">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  try {
    const assessments = await API.get('/assessments');
    const tbody = document.getElementById('assessments-tbody');
    if (!tbody) return;

    if (!assessments || assessments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No assessments yet. Create one!</td></tr>';
      return;
    }

    tbody.innerHTML = assessments.map(a => {
      const statusBadge = a.status === 'Active'
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-gray">Inactive</span>';
      return `
        <tr>
          <td><strong>${Utils.esc(a.title)}</strong></td>
          <td>${a.questionCount || '—'}</td>
          <td>${a.duration} min</td>
          <td>${a.passingScore}%</td>
          <td>${statusBadge}</td>
          <td>—</td>
          <td>
            <div class="flex gap-8">
              <button class="btn btn-sm btn-danger" onclick="deleteAssessment('${a.id}', '${Utils.esc(a.title)}')">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('assessments-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state text-danger">Failed to load assessments from server.</td></tr>';
    console.error('[Assessments] Failed to load list:', err);
  }
}

function toggleAssessmentStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  DB.update(DB.TABLES.ASSESSMENTS, id, { status: newStatus });
  renderAssessments();
}

async function deleteAssessment(id, title) {
  if (!Utils.confirm(`Delete "${title}"? This will also remove all associated questions.\n\nNote: Existing candidate assignments will be preserved.`)) return;

  try {
    await API.delete(`/assessments/${encodeURIComponent(id)}`);
  } catch (err) {
    console.error('[Assessments] Backend delete failed:', err);
    Utils.showMsg('assess-msg', 'Failed to delete from server: ' + (err.message || 'Server error'), 'error');
    return;
  }

  DB.delete(DB.TABLES.ASSESSMENTS, id);
  DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === id)
    .forEach(q => DB.delete(DB.TABLES.QUESTIONS, q.id));

  renderAssessments();
}
