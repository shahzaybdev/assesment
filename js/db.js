/**
 * DB — localStorage Database Layer
 * All records stored as JSON arrays. Auto-generates string IDs.
 */
const DB = (() => {
  const TABLES = {
    USERS:                 'pa_users',
    ASSESSMENTS:           'pa_assessments',
    QUESTIONS:             'pa_questions',
    CANDIDATES:            'pa_candidates',
    CANDIDATE_ASSESSMENTS: 'pa_candidate_assessments',
    RESPONSES:             'pa_responses'
  };

  function _id() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function get(table) {
    try { return JSON.parse(localStorage.getItem(table) || '[]'); }
    catch { return []; }
  }

  function _save(table, data) {
    localStorage.setItem(table, JSON.stringify(data));
  }

  function getById(table, id) {
    return get(table).find(r => r.id === id) || null;
  }

  function getWhere(table, predicate) {
    return get(table).filter(predicate);
  }

  function insert(table, record) {
    const data = get(table);
    const rec = { ...record, id: _id() };
    data.push(rec);
    _save(table, data);
    return rec;
  }

  function update(table, id, updates) {
    const data = get(table);
    const idx = data.findIndex(r => r.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates };
    _save(table, data);
    return data[idx];
  }

  function remove(table, id) {
    _save(table, get(table).filter(r => r.id !== id));
  }

  function clear(table) { _save(table, []); }

  function isSeeded()  { return localStorage.getItem('pa_seeded') === 'true'; }
  function markSeeded(){ localStorage.setItem('pa_seeded', 'true'); }
  function resetAll()  {
    Object.values(TABLES).forEach(t => clear(t));
    localStorage.removeItem('pa_seeded');
  }

  return { TABLES, get, getById, getWhere, insert, update, delete: remove, clear, isSeeded, markSeeded, resetAll };
})();
