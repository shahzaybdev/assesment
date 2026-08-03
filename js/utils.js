/**
 * Utils — Shared Utility Functions
 */
const Utils = {

  // ─── Date / Time ────────────────────────────────────────────────────────

  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  },

  /** Format seconds as "Xm Ys" */
  formatDuration(sec) {
    if (sec == null || isNaN(sec)) return '—';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  },

  /** Format seconds as MM:SS for countdown timer */
  formatTimer(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  // ─── HTML Helpers ────────────────────────────────────────────────────────

  esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  statusBadge(status) {
    const map = {
      'Applied':               'badge-gray',
      'Assessment Assigned':   'badge-info',
      'Assessment Completed':  'badge-warning',
      'Interview':             'badge-purple',
      'Selected':              'badge-success',
      'Rejected':              'badge-danger'
    };
    return `<span class="badge ${map[status]||'badge-gray'}">${Utils.esc(status)}</span>`;
  },

  passFailBadge(pf) {
    if (!pf) return '<span class="text-muted">—</span>';
    return `<span class="badge ${pf==='Pass'?'badge-success':'badge-danger'}">${pf}</span>`;
  },

  completionBadge(completed) {
    if (completed === true)  return '<span class="badge badge-success">Completed</span>';
    if (completed === false) return '<span class="badge badge-warning">Pending</span>';
    return '<span class="badge badge-gray">Not Assigned</span>';
  },

  showMsg(containerId, message, type = 'error') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${Utils.esc(message)}</div>`;
    if (type !== 'error') setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
  },

  clearMsg(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  },

  // ─── Scoring ─────────────────────────────────────────────────────────────

  /**
   * Calculate max possible score from an array of question records.
   */
  maxScore(questions) {
    return questions.reduce((s, q) => s + (Number(q.scoreValue) || 0), 0);
  },

  /**
   * Calculate percentage score.
   * @param {number} raw  - sum of scoreAwarded
   * @param {number} max  - sum of scoreValue
   * @returns {number}    - rounded percentage 0-100
   */
  calcPercentage(raw, max) {
    if (!max) return 0;
    return Math.round((raw / max) * 100);
  },

  // ─── Misc ────────────────────────────────────────────────────────────────

  /** Return human-readable question type label */
  qtypeLabel(type) {
    return type === 'likert' ? 'Likert Scale' : 'Multiple Choice';
  },

  /** Confirm dialog wrapper */
  confirm(msg) { return window.confirm(msg); },

  /** Navigate within an SPA by changing hash */
  go(hash) { window.location.hash = hash; }
};
