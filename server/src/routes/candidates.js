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

/**
 * POST /api/candidates/:id/assessments
 *
 * Assign an existing assessment to a candidate.
 * Creates an assessment_invitation in PostgreSQL.
 */
router.post('/:id/assessments', async (req, res) => {
  try {
    const { id: candidateId } = req.params;
    const { assessmentId } = req.body;

    if (!assessmentId) {
      return res.status(400).json({
        error: 'assessmentId is required'
      });
    }

    // 1. Find the candidate's application.
    const applicationResult = await query(`
      SELECT application_id
      FROM application
      WHERE candidate_id = $1
      ORDER BY date_updated_at DESC
      LIMIT 1
    `, [candidateId]);

    if (applicationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No application found for this candidate'
      });
    }

    const applicationId = applicationResult.rows[0].application_id;

    // 2. Verify that the assessment exists and is active.
    const assessmentResult = await query(`
      SELECT assessment_form_id, form_code, status
      FROM assessment_form
      WHERE assessment_form_id = $1
      LIMIT 1
    `, [assessmentId]);

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Assessment not found'
      });
    }

    const assessment = assessmentResult.rows[0];

    if (assessment.status !== 'Active') {
      return res.status(400).json({
        error: 'Assessment is not active'
      });
    }

    // 3. Prevent duplicate active/completed assignments.
    const existingResult = await query(`
      SELECT invitation_id, invitation_status
      FROM assessment_invitation
      WHERE application_id = $1
        AND assessment_form_id = $2
      ORDER BY invitation_id
    `, [applicationId, assessmentId]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      if (
        existing.invitation_status === 'Sent' ||
        existing.invitation_status === 'Completed'
      ) {
        return res.status(409).json({
          error: 'Assessment is already assigned to this candidate',
          invitationId: existing.invitation_id,
          status: existing.invitation_status
        });
      }
    }

    // 4. Generate an invitation ID.
    // DB allows maximum 10 characters.
    const suffix = Date.now().toString().slice(-6);
    const invitationId = `INV-${suffix}`;

    // 5. Generate a candidate-facing invitation link.
    const invitationLink =
      `#/assessment/${invitationId}`;

    // 6. Set expiry.
    // Assessment invitation expires after 48 hours.
    const expiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    );

    // 7. Create invitation.
    const insertResult = await query(`
      INSERT INTO assessment_invitation (
        invitation_id,
        application_id,
        assessment_form_id,
        invitation_link,
        expires_at,
        invitation_status
      )
      VALUES ($1, $2, $3, $4, $5, 'Sent')
      RETURNING
        invitation_id,
        application_id,
        assessment_form_id,
        invitation_link,
        expires_at,
        invitation_status
    `, [
      invitationId,
      applicationId,
      assessmentId,
      invitationLink,
      expiresAt
    ]);

    const invitation = insertResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Assessment assigned successfully',
      invitation
    });

  } catch (err) {
    console.error(
      `[Candidates] Error assigning assessment to ${req.params.id}:`,
      err.message
    );

    return res.status(500).json({
      error: 'Failed to assign assessment'
    });
  }
});

//ANOother 1 4rom GPT -------------------------
/**
 * GET /api/candidates
 *
 * Returns all candidates from PostgreSQL.
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`
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
      ORDER BY app.date_updated_at DESC NULLS LAST
    `);

    const candidates = result.rows.map(candidate => {
      if (candidate.resumeUrl) {
        candidate.resumeUrl = `${req.protocol}://${req.get('host')}${candidate.resumeUrl.startsWith('/') ? '' : '/'}${candidate.resumeUrl}`;
      }
      if (candidate.resumeName) {
        candidate.resumeName = candidate.resumeName
          .split('/')
          .pop();
      }

      return candidate;
    });

    return res.json(candidates);

  } catch (err) {
    console.error(
      '[Candidates] Error fetching all candidates:',
      err.message
    );

    return res.status(500).json({
      error: 'Database error'
    });
  }
});

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
        av.passing_percentage AS "passingPercentage",
        att.attempt_id,
        att.started_at AS "startedAt",
        att.submitted_at AS "submittedAt",
        att.time_taken_seconds AS "timeTakenSeconds",
        att.submission_type AS "submissionType",
        att.answered_questions AS "answeredQuestions",
        att.unanswered_questions AS "unansweredQuestions",
        att.raw_score AS "rawScore",
        att.maximum_score AS "maximumScore",
        att.percentage_score AS "percentageScore",
        att.status AS attempt_status
      FROM assessment_invitation inv
      JOIN application a
        ON inv.application_id = a.application_id
      JOIN assessment_form af
        ON inv.assessment_form_id = af.assessment_form_id
      LEFT JOIN assessment_version av
        ON af.assessment_version_id = av.assessment_version_id
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
      passingPercentage: row.passingPercentage,

      attempt: row.attempt_id
        ? {
          id: row.attempt_id,
          status: row.attempt_status,
          score: row.percentageScore,
          startedAt: row.startedAt,
          submittedAt: row.submittedAt,
          timeTakenSeconds: row.timeTakenSeconds,
          submissionType: row.submissionType,
          answeredQuestions: row.answeredQuestions,
          unansweredQuestions: row.unansweredQuestions,
          rawScore: row.rawScore,
          maximumScore: row.maximumScore,
          percentageScore: row.percentageScore
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


/**
 * PATCH /api/candidates/:id/recruitment-status
 *
 * Updates the candidate's recruitment status in PostgreSQL
 * by updating their most recent application record.
 */
router.patch('/:id/recruitment-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required'
      });
    }

    const result = await query(`
      UPDATE application
      SET application_status = $1, date_updated_at = CURRENT_TIMESTAMP
      WHERE application_id = (
        SELECT application_id FROM application WHERE candidate_id = $2 ORDER BY date_updated_at DESC LIMIT 1
      )
      RETURNING application_id, application_status, date_updated_at
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No application found for this candidate'
      });
    }

    return res.json({
      success: true,
      application: result.rows[0]
    });

  } catch (err) {
    console.error(
      `[Candidates] Error updating recruitment status for ${req.params.id}:`,
      err.message
    );

    return res.status(500).json({
      error: 'Database error'
    });
  }
});


module.exports = router;