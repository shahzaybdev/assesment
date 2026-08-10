/**
 * Auth — Authentication Layer
 * Supports: admin login, candidate email/password login, Google Sign-In, registration.
 * Session stored in sessionStorage.
 */
const Auth = (() => {
  const SESSION_KEY = 'pa_session';

  /** Simple djb2-style hash (NOT cryptographic — MVP only) */
  function _hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0; // keep unsigned 32-bit
    }
    return h.toString(36);
  }

  /** Decode a Google Identity Services JWT without a library */
  function _decodeJWT(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch { return null; }
  }

  function _setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  function login(email, password) {
    const e = (email || '').trim().toLowerCase();
    const adminEmail = (Config.ADMIN_EMAIL || 'admin@company.com').toLowerCase();

    // Admin
    if (e === adminEmail && password === (Config.ADMIN_PASSWORD || 'Admin@123')) {
      _setSession({ role: 'admin', email: e, name: 'HR Admin', id: 'admin' });
      return { success: true, role: 'admin' };
    }

    // Candidate
    const users = DB.get(DB.TABLES.USERS);
    const user = users.find(u => u.email === e && u.passwordHash === _hash(password) && u.role === 'candidate');
    if (user) {
      _setSession({ role: 'candidate', email: user.email, name: user.name, id: user.id, candidateId: user.candidateId });
      return { success: true, role: 'candidate' };
    }

    return { success: false, error: 'Invalid email or password.' };
  }

  /**
   * Called by Google GIS callback with the credential JWT.
   * Extracts profile, creates candidate + user if new, then sets session.
   */
  function handleGoogleCredential(credential) {
    const profile = _decodeJWT(credential);
    if (!profile) return { success: false, error: 'Invalid Google token.' };

    const e = profile.email.toLowerCase();
    const users = DB.get(DB.TABLES.USERS);
    let user = users.find(u => u.email === e);

    if (!user) {
      // Auto-register as new candidate
      const candidate = DB.insert(DB.TABLES.CANDIDATES, {
        name: profile.name,
        email: e,
        picture: profile.picture || '',
        resumeUrl: '',
        resumeName: '',
        recruitmentStatus: 'Applied',
        appliedAt: new Date().toISOString()
      });
      user = DB.insert(DB.TABLES.USERS, {
        email: e,
        name: profile.name,
        role: 'candidate',
        googleId: profile.sub,
        passwordHash: '',
        candidateId: candidate.id,
        createdAt: new Date().toISOString()
      });
    }

    _setSession({ role: 'candidate', email: user.email, name: user.name, id: user.id, candidateId: user.candidateId });
    return { success: true, role: 'candidate' };
  }

  function register(name, email, password) {
    const e = (email || '').trim().toLowerCase();
    if (!name || !e || !password) return { success: false, error: 'All fields are required.' };
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

    const users = DB.get(DB.TABLES.USERS);
    if (users.find(u => u.email === e)) return { success: false, error: 'Email already registered.' };

    const candidate = DB.insert(DB.TABLES.CANDIDATES, {
      name: name.trim(),
      email: e,
      picture: '',
      resumeUrl: '',
      resumeName: '',
      recruitmentStatus: 'Applied',
      appliedAt: new Date().toISOString()
    });
    DB.insert(DB.TABLES.USERS, {
      email: e,
      name: name.trim(),
      role: 'candidate',
      passwordHash: _hash(password),
      googleId: '',
      candidateId: candidate.id,
      createdAt: new Date().toISOString()
    });
    return { success: true };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function isLoggedIn() { return !!getCurrentUser(); }

  /** Redirect to login if not authenticated or wrong role. Returns user or null. */
  function requireAuth(role) {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    if (role && user.role !== role) { window.location.href = 'index.html'; return null; }
    return user;
  }

  return { login, handleGoogleCredential, register, logout, getCurrentUser, isLoggedIn, requireAuth };
})();
