/**
 * index.js — Express application entry point
 *
 * Responsibilities:
 *  - Load environment variables from .env
 *  - Create and configure the Express app
 *  - Mount routes
 *  - Start the HTTP server
 *
 * Environment variables (all required — see .env.example):
 *   PORT         - HTTP port to listen on (default: 3000)
 *   DB_HOST      - PostgreSQL host
 *   DB_PORT      - PostgreSQL port
 *   DB_NAME      - PostgreSQL database name
 *   DB_USER      - PostgreSQL user
 *   DB_PASSWORD  - PostgreSQL password
 *   CORS_ORIGIN  - Allowed CORS origin (default: *)
 */

'use strict';

// ── 1. Load .env before anything else ─────────────────────────────────────────
require('dotenv').config();

// ── 2. Validate required environment variables ─────────────────────────────────
const REQUIRED_ENV = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[Startup] Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

// ── 3. Dependencies ────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');

// ── 4. Routes ──────────────────────────────────────────────────────────────────
const healthRouter = require('./routes/health');
const assessmentsRouter = require('./routes/assessments');
const questionsRouter = require('./routes/questions');
const candidatesRouter = require('./routes/candidates');
const dashboardRouter = require('./routes/dashboard');
// - Rout by GPT 
const authRoutes = require('./routes/auth');

// ── 5. App setup ───────────────────────────────────────────────────────────────
const app = express();

// CORS — allow configured origin (or * for local dev)
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Parse JSON request bodies
app.use(express.json());

// Serve uploaded resumes statically
app.use('/uploads', express.static('uploads'));

// Request logger (simple, no external dependency)
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// ── 6. Mount routes ────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/assessments', assessmentsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/dashboard', dashboardRouter);
// - Rout by GPT 
app.use('/api/auth', authRoutes);

// 404 handler for unmatched API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── 7. Start server ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, () => {
  console.log('─────────────────────────────────────────');
  console.log(`  Career Portal API — server started`);
  console.log(`  Port    : ${PORT}`);
  console.log(`  DB host : ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`  DB name : ${process.env.DB_NAME}`);
  console.log(`  Health  : http://localhost:${PORT}/api/health`);
  console.log('─────────────────────────────────────────');
});

module.exports = app; // exported for future testing
