'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db');

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Candidate authentication against PostgreSQL.
 *
 * Request:
 * {
 *   "email": "salman.baig90@gmail.com",
 *   "password": "..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "role": "candidate",
 *     "id": "HOT004",
 *     "candidateId": "HOT004",
 *     "email": "...",
 *     "name": "..."
 *   }
 * }
 */
router.post('/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '').trim();

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required.'
            });
        }

        const result = await query(
            `
      SELECT
        ca.candidate_id,
        ca.email,
        ca.password_hash,
        ca.account_status,
        CONCAT(cp.first_name, ' ', cp.last_name) AS name
      FROM candidate_account ca
      LEFT JOIN candidate_profile cp
        ON ca.candidate_id = cp.candidate_id
      WHERE LOWER(ca.email) = LOWER($1)
      LIMIT 1
      `,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        const candidate = result.rows[0];

        if (candidate.account_status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Candidate account is not active.'
            });
        }

        if (!candidate.password_hash) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            candidate.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        await query(
            `
      UPDATE candidate_account
      SET last_login_at = NOW()
      WHERE candidate_id = $1
      `,
            [candidate.candidate_id]
        );

        return res.json({
            success: true,
            user: {
                role: 'candidate',
                id: candidate.candidate_id,
                candidateId: candidate.candidate_id,
                email: candidate.email,
                name: candidate.name || candidate.email
            }
        });

    } catch (err) {
        console.error('[Auth] Login error:', err.message);

        return res.status(500).json({
            success: false,
            error: 'Authentication service error.'
        });
    }
});


/**
 * GET /api/auth/diagnostic/:candidateId
 *
 * Diagnostic-only endpoint.
 *
 * This does NOT expose the password hash.
 * It allows us to verify that:
 *
 * Frontend candidate identity
 *        ↓
 * candidateId
 *        ↓
 * PostgreSQL candidate_account
 *        ↓
 * candidate_profile
 *
 * is correctly mapped.
 */
router.get('/diagnostic/:candidateId', async (req, res) => {
    try {
        const { candidateId } = req.params;

        const result = await query(
            `
      SELECT
        ca.candidate_id,
        ca.email,
        ca.account_status,
        CASE
          WHEN ca.password_hash IS NULL THEN false
          ELSE true
        END AS has_password,
        CONCAT(cp.first_name, ' ', cp.last_name) AS name
      FROM candidate_account ca
      LEFT JOIN candidate_profile cp
        ON ca.candidate_id = cp.candidate_id
      WHERE ca.candidate_id = $1
      LIMIT 1
      `,
            [candidateId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Candidate not found.'
            });
        }

        const candidate = result.rows[0];

        return res.json({
            success: true,
            identity: {
                candidateId: candidate.candidate_id,
                email: candidate.email,
                name: candidate.name,
                accountStatus: candidate.account_status,
                hasPassword: candidate.has_password
            }
        });

    } catch (err) {
        console.error(
            `[Auth Diagnostic] Error for ${req.params.candidateId}:`,
            err.message
        );

        return res.status(500).json({
            success: false,
            error: 'Diagnostic database error.'
        });
    }
});


module.exports = router;