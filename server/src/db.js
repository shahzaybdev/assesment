/**
 * db.js — PostgreSQL connection pool
 *
 * Creates a single shared `pg.Pool` configured entirely from environment
 * variables. No credentials are hardcoded here.
 *
 * Required environment variables:
 *   DB_HOST     - PostgreSQL host (e.g. localhost)
 *   DB_PORT     - PostgreSQL port (e.g. 5432)
 *   DB_NAME     - Database name
 *   DB_USER     - Database user
 *   DB_PASSWORD - Database password
 */

'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Keep idle connections alive but cap the pool size sensibly
  max:                20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Surface pool-level errors without crashing the process
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * query(text, params)
 * Thin wrapper around pool.query — keeps route handlers clean.
 *
 * @param {string}   text   - SQL query string
 * @param {Array}    [params] - Parameterised values
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] query | ${duration}ms | rows:${result.rowCount} | ${text.slice(0, 80)}`);
  return result;
}

/**
 * testConnection()
 * Executes a minimal query to verify the pool can reach PostgreSQL.
 * Returns { ok: true, serverTime } or throws on failure.
 */
async function testConnection() {
  const result = await pool.query('SELECT NOW() AS server_time');
  return {
    ok: true,
    serverTime: result.rows[0].server_time,
  };
}

module.exports = { pool, query, testConnection };
