/**
 * health.js — Health check route
 *
 * GET /api/health
 *
 * Returns:
 *   200 { status: "ok",  server: "running", db: { ok: true,  serverTime: "..." } }
 *   503 { status: "error", server: "running", db: { ok: false, error: "..." } }
 */

'use strict';

const express  = require('express');
const { testConnection } = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  let db;
  try {
    db = await testConnection();
  } catch (err) {
    console.error('[Health] PostgreSQL connectivity check failed:', err.message);
    db = { ok: false, error: err.message };
  }

  const httpStatus = db.ok ? 200 : 503;

  return res.status(httpStatus).json({
    status:    db.ok ? 'ok' : 'error',
    server:    'running',
    timestamp: new Date().toISOString(),
    db,
  });
});

module.exports = router;
