/**
 * API Client Helper for frontend API requests
 */
const API = {
  baseUrl: 'http://localhost:3000/api',

  async get(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[API Helper] GET error:', err);
      throw err;
    }
  },

  async post(endpoint, body) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[API Helper] POST error:', err);
      throw err;
    }
  },

  async patch(endpoint, body) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[API Helper] PATCH error:', err);
      throw err;
    }
  },

  async delete(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return true;
    } catch (err) {
      console.error('[API Helper] DELETE error:', err);
      throw err;
    }
  }
};
