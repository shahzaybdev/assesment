/**
 * Candidate Portal — Home Page
 *
 * Shows:
 * 1. Pending / assigned assessments
 * 2. Completed assessments and results
 */

async function renderPortal(user) {
  try {
    // ------------------------------------------------------------
    // Load candidate
    // ------------------------------------------------------------

    const candidate = await API.get(
      `/candidates/${user.candidateId}`
    );

    if (!candidate) {
      document.getElementById('c-content').innerHTML = `
        <div class="alert alert-error">
          Candidate record not found. Please contact HR.
        </div>
      `;
      return;
    }

    // ------------------------------------------------------------
    // Load candidate assignments
    // ------------------------------------------------------------

    const allCAs = await API.get(
      `/candidates/${user.candidateId}/assessments`
    );

    // ------------------------------------------------------------
    // Load assessment definitions
    // ------------------------------------------------------------

    const assessmentsList = await API.get('/assessments');

    // ------------------------------------------------------------
    // Separate Pending and Completed
    // ------------------------------------------------------------

    const pendingAssessments = [];
    const completedAssessments = [];

    allCAs.forEach(ca => {
      const assessment = assessmentsList.find(
        a => a.id === ca.assessmentId
      );

      if (!assessment) {
        console.warn(
          '[Portal] Assessment definition not found:',
          ca.assessmentId
        );
        return;
      }

      const attemptStatus =
        ca.attempt?.status || '';

      const invitationStatus =
        ca.status || '';

      // Completed if either the invitation OR attempt says Completed
      const isCompleted =
        invitationStatus.toLowerCase() === 'completed' ||
        attemptStatus.toLowerCase() === 'completed';

      if (isCompleted) {
        completedAssessments.push({
          ca,
          assessment
        });
      } else {
        pendingAssessments.push({
          ca,
          assessment
        });
      }
    });

    // ------------------------------------------------------------
    // Sort by assigned date
    // ------------------------------------------------------------

    pendingAssessments.sort(
      (a, b) =>
        new Date(a.ca.assignedAt || 0) -
        new Date(b.ca.assignedAt || 0)
    );

    completedAssessments.sort(
      (a, b) =>
        new Date(b.ca.assignedAt || 0) -
        new Date(a.ca.assignedAt || 0)
    );

    // ------------------------------------------------------------
    // Render Pending Assessments
    // ------------------------------------------------------------

    const pendingHTML = pendingAssessments.length === 0
      ? `
        <div class="card text-center" style="
          padding:30px;
          color:var(--text-secondary);
          margin-bottom:20px;
        ">
          <div style="font-size:28px;margin-bottom:8px;color:var(--accent-green);">✓</div>
          <div style="font-weight:600;color:var(--text-primary);">
            No pending assessments
          </div>
          <div style="font-size:13px;margin-top:5px;color:var(--text-muted);">
            You have completed all currently assigned assessments.
          </div>
        </div>
      `
      : pendingAssessments.map(({ ca, assessment }) => {

        const durationText =
          assessment.duration
            ? `${assessment.duration} minutes`
            : '—';

        const qCount =
          assessment.questionCount || 0;

        const passingScore =
          assessment.passingScore || 0;

        const dueDate = ca.dueDate
          ? new Date(ca.dueDate).toLocaleDateString(
            'en-US',
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }
          )
          : '—';

        return `
            <div class="assessment-card">

              <div class="assessment-card-header">

                <div>
                  <div class="assessment-card-title">
                    ${Utils.esc(assessment.title)}
                  </div>

                  <div class="assessment-card-meta">
                    Duration: ${durationText}
                    · ${qCount} Questions
                    · Passing Score: ${passingScore}%
                  </div>
                </div>

                <span class="badge badge-warning">
                  Pending
                </span>

              </div>

              <div class="text-muted" style="font-size:13px;margin:10px 0 14px;">
                Due: ${dueDate}
              </div>

              <button
                class="btn btn-primary"
                onclick="startAssessment('${Utils.esc(ca.invitationId)}')"
              >
                Start Assessment
              </button>

            </div>
          `;
      }).join('');

    // ------------------------------------------------------------
    // Render Completed Assessments
    // ------------------------------------------------------------

    const completedHTML = completedAssessments.length === 0
      ? `
        <div class="card text-center" style="
          padding:30px;
          color:var(--text-muted);
        ">
          No completed assessments yet.
        </div>
      `
      : completedAssessments.map(({ ca, assessment }) => {

        const score =
          parseFloat(ca.attempt?.score || 0);

        const passingScore =
          parseFloat(assessment.passingScore || 0);

        const isPass =
          score >= passingScore;

        const resultClass =
          isPass
            ? 'result-pass'
            : 'result-fail';

        const icon =
          isPass
            ? '✅'
            : '❌';

        return `
            <div class="assessment-card">

              <div class="assessment-card-header">

                <div>
                  <div class="assessment-card-title">
                    ${Utils.esc(assessment.title)}
                  </div>

                  <div class="assessment-card-meta">
                    Completed
                  </div>
                </div>

                <span class="badge badge-success">
                  Completed
                </span>

              </div>

              <div class="result-card ${resultClass} mt-12">

                <div class="result-score">
                  ${icon} ${score}%
                </div>

                <div class="result-label">
                  ${isPass
            ? 'Congratulations! You passed.'
            : 'You did not meet the passing score. Better luck next time.'
          }
                </div>

              </div>

            </div>
          `;
      }).join('');

    // ------------------------------------------------------------
    // Final Portal UI
    // ------------------------------------------------------------

    document.getElementById('c-content').innerHTML = `

      <h2 class="page-title">
        Welcome, ${Utils.esc(candidate.name)}
      </h2>

      <p class="text-muted mb-16">
        Status:
        ${Utils.statusBadge(candidate.recruitmentStatus)}
      </p>


      <!-- ======================================================
           PENDING ASSESSMENTS
           ====================================================== -->

      <div class="section-header">

        <h3 class="section-title">
          Pending Assessments
        </h3>

        ${pendingAssessments.length > 0
        ? `
              <span class="badge badge-warning">
                ${pendingAssessments.length} Pending
              </span>
            `
        : ''
      }

      </div>

      ${pendingHTML}


      <!-- ======================================================
           COMPLETED ASSESSMENTS
           ====================================================== -->

      <h3 class="section-title" style="margin-top:24px;">

        Completed Assessments
      </h3>

      ${completedHTML}

    `;

  } catch (err) {

    console.error(
      '[Portal] Failed to load portal:',
      err
    );

    document.getElementById('c-content').innerHTML = `
      <div class="alert alert-error">
        Failed to load portal data. Please try again.
      </div>
    `;
  }
}


// ================================================================
// START ASSESSMENT
// ================================================================

function startAssessment(invitationId) {

  if (!invitationId) {
    console.error(
      '[Portal] Missing invitation ID'
    );

    return;
  }

  Utils.go(
    '#/assessment/' +
    encodeURIComponent(invitationId)
  );
}