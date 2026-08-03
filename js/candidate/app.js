/**
 * Candidate App — Router & Shell
 */
function initCandidateApp() {
  const user = Auth.requireAuth('candidate');
  if (!user) return;

  // Set header user name
  document.getElementById('c-user-name').textContent = user.name;

  function highlightNav(page) {
    document.querySelectorAll('.c-nav a[data-page]').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
  }

  function route() {
    const hash  = location.hash || '#/portal';
    const parts = hash.replace(/^#\//, '').split('/');
    const page  = parts[0] || 'portal';
    const sub1  = parts[1] || '';

    // Stop any running assessment timer if navigating away
    if (page !== 'assessment' && _ta.timerInterval) {
      clearInterval(_ta.timerInterval);
    }

    switch (page) {
      case 'portal':
        highlightNav('portal');
        renderPortal(user);
        break;
      case 'assessment':
        highlightNav('portal');
        renderTakeAssessment(sub1, user);
        break;
      case 'profile':
        highlightNav('profile');
        renderProfile(user);
        break;
      default:
        highlightNav('portal');
        renderPortal(user);
    }
  }

  window.addEventListener('hashchange', route);
  route();
}

document.addEventListener('DOMContentLoaded', () => {
  seedDatabase();
  initCandidateApp();
});
