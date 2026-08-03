/**
 * Admin — Assessment Management List Page
 */
function renderAssessments() {
  const assessments = DB.get(DB.TABLES.ASSESSMENTS);
  const questions   = DB.get(DB.TABLES.QUESTIONS);
  const allCAs      = DB.get(DB.TABLES.CANDIDATE_ASSESSMENTS);

  const rows = assessments.map(a => {
    const qCount = questions.filter(q => q.assessmentId === a.id).length;
    const caCount = allCAs.filter(ca => ca.assessmentId === a.id).length;
    const statusBadge = a.status === 'Active'
      ? '<span class="badge badge-success">Active</span>'
      : '<span class="badge badge-gray">Inactive</span>';

    return `
      <tr>
        <td><strong>${Utils.esc(a.title)}</strong></td>
        <td>${qCount}</td>
        <td>${a.duration} min</td>
        <td>${a.passingScore}%</td>
        <td>${statusBadge}</td>
        <td>${caCount}</td>
        <td>${Utils.formatDate(a.createdAt)}</td>
        <td>
          <div class="flex gap-8">
            <a href="#/assessments/edit/${a.id}" class="btn btn-sm btn-outline">Edit</a>
            <button class="btn btn-sm ${a.status==='Active'?'btn-warning':'btn-success'}"
              onclick="toggleAssessmentStatus('${a.id}','${a.status}')">
              ${a.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteAssessment('${a.id}','${Utils.esc(a.title)}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <h2>Assessments</h2>
      <a href="#/assessments/new" class="btn btn-primary">+ New Assessment</a>
    </div>
    <div id="assess-msg"></div>
    <div class="card" style="padding:0">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Assessment Name</th>
              <th>Questions</th>
              <th>Duration</th>
              <th>Passing Score</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" class="empty-state">No assessments yet. Create one!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function toggleAssessmentStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  DB.update(DB.TABLES.ASSESSMENTS, id, { status: newStatus });
  renderAssessments();
}

function deleteAssessment(id, title) {
  if (!Utils.confirm(`Delete "${title}"? This will also remove all associated questions.\n\nNote: Existing candidate assignments will be preserved.`)) return;
  DB.delete(DB.TABLES.ASSESSMENTS, id);
  // Cascade delete questions
  DB.getWhere(DB.TABLES.QUESTIONS, q => q.assessmentId === id)
    .forEach(q => DB.delete(DB.TABLES.QUESTIONS, q.id));
  renderAssessments();
}
