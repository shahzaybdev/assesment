/**
 * Admin App — Router & Shell
 * Initialises admin SPA: auth guard, sidebar, hash-based routing.
 */
function initAdminApp() {
  const user = Auth.requireAuth('admin');
  if (!user) return;

  document.getElementById('admin-user-name').textContent = user.name;

  async function route() {
    const hash  = location.hash || '#/dashboard';
    const parts = hash.replace(/^#\//, '').split('/');
    const page  = parts[0] || 'dashboard';
    const sub1  = parts[1] || '';
    const sub2  = parts[2] || '';

    // Highlight active nav link
    document.querySelectorAll('.sidebar nav a[data-page]').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });

    switch (page) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'assessments':
        if (sub1 === 'new')          renderAssessmentForm(null);
        else if (sub1 === 'edit')    renderAssessmentForm(sub2);
        else                         await renderAssessments();
        break;
      case 'candidates':
        if (sub1)                    await renderCandidateProfile(sub1);
        else                         await renderDashboard();
        break;
      default:
        await renderDashboard();
    }
  }

  window.addEventListener('hashchange', route);
  route();
}

document.addEventListener('DOMContentLoaded', () => {
  seedDatabase();
  initAdminApp();
});
