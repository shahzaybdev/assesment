/**
 * Auth — Authentication Layer
 *
 * Supports:
 * - Admin login
 * - Candidate email/password login
 * - Google Sign-In
 * - Candidate registration
 *
 * Candidate identity is resolved from PostgreSQL through the backend API.
 * Session is stored in sessionStorage.
 */

const Auth = (() => {
  const SESSION_KEY = 'pa_session';

  /**
   * Simple djb2-style hash.
   * NOT cryptographic — MVP only.
   */
  function _hash(str) {
    let h = 5381;

    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }

    return h.toString(36);
  }

  /**
   * Decode a Google Identity Services JWT without a library.
   */
  function _decodeJWT(token) {
    try {
      const parts = token.split('.');

      if (parts.length < 2) {
        return null;
      }

      const base64 = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      return JSON.parse(atob(base64));
    } catch (err) {
      console.error('[Auth] Failed to decode Google JWT:', err);
      return null;
    }
  }

  /**
   * Store authenticated session.
   */
  function _setSession(session) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    );
  }

  // ============================================================
  // LOGIN
  // ============================================================

  /**
   * Login user.
   *
   * Admin:
   * - Still handled locally.
   *
   * Candidate:
   * - Identity is resolved from PostgreSQL through:
   *   GET /api/candidates/by-email/:email
   *
   * NOTE:
   * Candidate password validation is NOT yet handled by PostgreSQL.
   * This phase is only establishing the PostgreSQL candidate identity
   * bridge.
   */
  async function login(email, password) {
    const e = (email || '').trim().toLowerCase();
    const p = (password || '').trim();

    const adminEmail = (
      Config.ADMIN_EMAIL || 'admin@company.com'
    ).toLowerCase();

    // ==========================================================
    // ADMIN LOGIN
    // ==========================================================

    if (
      e === adminEmail &&
      p === (Config.ADMIN_PASSWORD || 'Admin@123')
    ) {
      _setSession({
        role: 'admin',
        email: e,
        name: 'HR Admin',
        id: 'admin'
      });

      return {
        success: true,
        role: 'admin'
      };
    }

    // ==========================================================
    // CANDIDATE LOGIN
    // ==========================================================

    try {
      const response = await fetch(
        'http://localhost:3000/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, password: p })
        }
      );

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        _setSession({
          role: data.user.role,
          email: data.user.email,
          name: data.user.name,
          id: data.user.id,
          candidateId: data.user.candidateId
        });

        return {
          success: true,
          role: data.user.role
        };
      }

      return {
        success: false,
        error: data.error || 'Invalid email or password.'
      };

    } catch (err) {
      console.error(
        '[Auth] Candidate login failed:',
        err
      );

      return {
        success: false,
        error: 'Unable to connect to the server. Please try again.'
      };
    }
  }

  // ============================================================
  // GOOGLE LOGIN
  // ============================================================

  /**
   * Called by Google GIS callback with the credential JWT.
   *
   * Google registration remains LocalStorage-based for now.
   * This is intentionally not part of the PostgreSQL identity
   * migration yet.
   */
  function handleGoogleCredential(credential) {
    const profile = _decodeJWT(credential);

    if (!profile) {
      return {
        success: false,
        error: 'Invalid Google token.'
      };
    }

    const e = (profile.email || '').toLowerCase();

    if (!e) {
      return {
        success: false,
        error: 'Google account email not available.'
      };
    }

    const users = DB.get(DB.TABLES.USERS);

    let user = users.find(u => u.email === e);

    if (!user) {
      const candidate = DB.insert(
        DB.TABLES.CANDIDATES,
        {
          name: profile.name || '',
          email: e,
          picture: profile.picture || '',
          resumeUrl: '',
          resumeName: '',
          recruitmentStatus: 'Applied',
          appliedAt: new Date().toISOString()
        }
      );

      user = DB.insert(
        DB.TABLES.USERS,
        {
          email: e,
          name: profile.name || '',
          role: 'candidate',
          googleId: profile.sub || '',
          passwordHash: '',
          candidateId: candidate.id,
          createdAt: new Date().toISOString()
        }
      );
    }

    _setSession({
      role: 'candidate',
      email: user.email,
      name: user.name,
      id: user.id,
      candidateId: user.candidateId
    });

    return {
      success: true,
      role: 'candidate'
    };
  }

  // ============================================================
  // REGISTRATION
  // ============================================================

  /**
   * Registration remains LocalStorage-based for now.
   * Candidate write operations will be migrated separately.
   */
  function register(name, email, password) {
    const e = (email || '').trim().toLowerCase();

    if (!name || !e || !password) {
      return {
        success: false,
        error: 'All fields are required.'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters.'
      };
    }

    const users = DB.get(DB.TABLES.USERS);

    if (users.find(u => u.email === e)) {
      return {
        success: false,
        error: 'Email already registered.'
      };
    }

    const candidate = DB.insert(
      DB.TABLES.CANDIDATES,
      {
        name: name.trim(),
        email: e,
        picture: '',
        resumeUrl: '',
        resumeName: '',
        recruitmentStatus: 'Applied',
        appliedAt: new Date().toISOString()
      }
    );

    DB.insert(
      DB.TABLES.USERS,
      {
        email: e,
        name: name.trim(),
        role: 'candidate',
        passwordHash: _hash(password),
        googleId: '',
        candidateId: candidate.id,
        createdAt: new Date().toISOString()
      }
    );

    return {
      success: true
    };
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  // ============================================================
  // SESSION
  // ============================================================

  function getCurrentUser() {
    try {
      return JSON.parse(
        sessionStorage.getItem(SESSION_KEY) || 'null'
      );
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  /**
   * Redirect to login if not authenticated or wrong role.
   */
  function requireAuth(role) {
    const user = getCurrentUser();

    if (!user) {
      window.location.href = 'index.html';
      return null;
    }

    if (role && user.role !== role) {
      window.location.href = 'index.html';
      return null;
    }

    return user;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    login,
    handleGoogleCredential,
    register,
    logout,
    getCurrentUser,
    isLoggedIn,
    requireAuth
  };
})();