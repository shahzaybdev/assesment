'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /api/candidates/by-email/:email
 *
 * Candidate Identity Bridge
 *
 * Resolves a candidate's PostgreSQL candidate_id from their email.
 * Used by the frontend authentication layer to create the correct
 * PostgreSQL-backed candidate session.
 */
router.get('/by-email/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const result = await query(
      `
      SELECT
        ca.candidate_id AS id,
        ca.email,
        cp.first_name,
        cp.last_name
      FROM candidate_account ca
      JOIN candidate_profile cp
        ON cp.candidate_id = ca.candidate_id
      WHERE LOWER(ca.email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Candidate not found'
      });
    }

    const candidate = result.rows[0];

    return res.json({
      id: candidate.id,
      email: candidate.email,
      name: [candidate.first_name, candidate.last_name]
        .filter(Boolean)
        .join(' ')
    });

  } catch (err) {
    console.error(
      '[Candidates] Email identity lookup error:',
      err.message
    );

    return res.status(500).json({
      error: 'Failed to resolve candidate'
    });
  }
});


/**
 * GET /api/candidates/:id
 *
 * Returns the candidate profile from PostgreSQL.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        ca.candidate_id AS id,
        ca.email,
        ca.account_status,
        cp.first_name,
        cp.last_name,
        CONCAT(cp.first_name, ' ', cp.last_name) AS name,
        cp.date_of_birth,
        cp.gender,
        cp.nationality,
        cp.phone_number,
        cp.city,
        cp.country,
        cp.candidate_type,
        ca.last_login_at,
        app.application_status AS "recruitmentStatus",
        app.date_updated_at AS "appliedAt",
        cr.resume_file_url AS "resumeUrl",
        cr.resume_file_url AS "resumeName"
      FROM candidate_account ca
      LEFT JOIN candidate_profile cp
        ON ca.candidate_id = cp.candidate_id
      LEFT JOIN application app
        ON ca.candidate_id = app.candidate_id
      LEFT JOIN candidate_resume cr
        ON ca.candidate_id = cr.candidate_id
      WHERE ca.candidate_id = $1
      ORDER BY app.date_updated_at DESC
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Candidate not found'
      });
    }

    const candidate = result.rows[0];

    // Do not expose sensitive authentication fields.
    // Clean up resume filename for frontend display.
    if (candidate.resumeName) {
      candidate.resumeName = candidate.resumeName
        .split('/')
        .pop();
    }

    return res.json(candidate);

  } catch (err) {
    console.error(
      `[Candidates] Error fetching ${req.params.id}:`,
      err.message
    );

    return res.status(500).json({
      error: 'Database error'
    });
  }
});


/**
 * GET /api/candidates/:id/assessments
 *
 * Returns assessments assigned to this candidate,
 * including any existing assessment attempt.
 */
router.get('/:id/assessments', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        a.candidate_id,
        inv.invitation_id,
        inv.assessment_form_id AS assessment_id,
        af.form_code AS title,
        inv.invitation_status AS status,
        inv.opened_at AS "assignedAt",
        inv.expires_at AS "dueDate",
        att.attempt_id,
        att.status AS attempt_status,
        att.percentage_score AS score
      FROM assessment_invitation inv
      JOIN application a
        ON inv.application_id = a.application_id
      JOIN assessment_form af
        ON inv.assessment_form_id = af.assessment_form_id
      LEFT JOIN assessment_attempt att
        ON inv.invitation_id = att.invitation_id
      WHERE a.candidate_id = $1
      ORDER BY inv.opened_at ASC
      `,
      [id]
    );

    const assessments = result.rows.map(row => ({
      candidateId: row.candidate_id,
      invitationId: row.invitation_id,
      assessmentId: row.assessment_id,
      title: row.title,
      status: row.status,
      assignedAt: row.assignedAt,
      dueDate: row.dueDate,

      attempt: row.attempt_id
        ? {
          id: row.attempt_id,
          status: row.attempt_status,
          score: row.score
        }
        : null
    }));

    return res.json(assessments);

  } catch (err) {
    console.error(
      `[Candidates] Error fetching assessments for ${req.params.id}:`,
      err.message
    );

    return res.status(500).json({
      error: 'Database error'
    });
  }
});


module.exports = router;