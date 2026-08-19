'use strict';

const express = require('express');
const { query, pool } = require('../db');

const router = express.Router();

// GET /api/assessments
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        af.assessment_form_id AS id,
        af.form_code,
        af.status AS form_status,
        av.duration_minutes AS duration,
        av.total_questions,
        av.maximum_score,
        av.passing_percentage
      FROM assessment_form af
      JOIN assessment_version av ON af.assessment_version_id = av.assessment_version_id
      WHERE af.status != 'Deleted'
    `);

    // Map to a frontend-friendly format (without modifying the DB)
    const assessments = result.rows.map(row => ({
      id: row.id,
      title: row.form_code, // DB doesn't have title, using form_code
      duration: row.duration,
      passingScore: row.passing_percentage,
      status: row.form_status,
      questionCount: row.total_questions,
      maxScore: row.maximum_score
    }));

    res.json(assessments);
  } catch (err) {
    console.error('[Assessments] Error fetching list:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/assessments/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch assessment form details
    const formResult = await query(`
      SELECT 
        af.assessment_form_id AS id,
        af.form_code,
        af.status AS form_status,
        av.duration_minutes AS duration,
        av.total_questions,
        av.maximum_score,
        av.passing_percentage
      FROM assessment_form af
      JOIN assessment_version av ON af.assessment_version_id = av.assessment_version_id
      WHERE af.assessment_form_id = $1
    `, [id]);

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessmentRow = formResult.rows[0];
    const assessment = {
      id: assessmentRow.id,
      title: assessmentRow.form_code,
      duration: assessmentRow.duration,
      passingScore: assessmentRow.passing_percentage,
      status: assessmentRow.form_status,
      maxScore: assessmentRow.maximum_score,
      questions: []
    };

    // 2. Fetch linked questions via form_question
    // We only fetch the question details here. Options are fetched below.
    const questionsResult = await query(`
      SELECT 
        q.question_id AS id,
        q.question_text,
        q.question_type,
        q.difficulty_level,
        fq.question_number AS "order",
        fq.question_weight AS score_value
      FROM form_question fq
      JOIN question q ON fq.question_id = q.question_id
      WHERE fq.assessment_form_id = $1
      ORDER BY fq.question_number
    `, [id]);

    const questions = questionsResult.rows;

    // 3. Fetch options for all questions in this assessment
    if (questions.length > 0) {
      const questionIds = questions.map(q => q.id);

      const optionsResult = await query(`
        SELECT 
          option_id,
          question_id,
          option_label,
          option_text AS text,
          score_value
        FROM question_option
        WHERE question_id = ANY($1)
      `, [questionIds]);

      const options = optionsResult.rows;

      // Map options to their respective questions
      questions.forEach(q => {
        q.options = options
          .filter(opt => opt.question_id === q.id)
          .map(opt => ({
            id: opt.option_id,
            label: opt.option_label,
            text: opt.text,
            scoreValue: opt.score_value
          }));
      });
    }

    assessment.questions = questions;
    res.json(assessment);

  } catch (err) {
    console.error(`[Assessments] Error fetching ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/assessments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT assessment_form_id FROM assessment_form WHERE assessment_form_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    await query("UPDATE assessment_form SET status = 'Deleted' WHERE assessment_form_id = $1", [id]);
    
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (err) {
    console.error(`[Assessments] Error deleting ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Database error' });
  }
});


// POST /api/assessments/:invitationId/start
router.post('/:invitationId/start', async (req, res) => {
  try {
    const { invitationId } = req.params;

    // 1. Verify invitation exists and get its status
    const invResult = await query(`
      SELECT invitation_id, assessment_form_id, invitation_status, expires_at
      FROM assessment_invitation
      WHERE invitation_id = $1
    `, [invitationId]);

    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = invResult.rows[0];

    // 2. Check invitation_status — only 'Sent' invitations may be started
    if (invitation.invitation_status !== 'Sent') {
      return res.status(400).json({ error: `Invitation cannot be started (status: ${invitation.invitation_status})` });
    }

    // 3. Check existing attempt for this invitation
    const attemptResult = await query(`
      SELECT attempt_id, status, started_at
      FROM assessment_attempt
      WHERE invitation_id = $1
      ORDER BY started_at DESC
      LIMIT 1
    `, [invitationId]);

    if (attemptResult.rows.length > 0) {
      const existing = attemptResult.rows[0];

      // Already in-progress: return existing attempt (idempotent)
      if (existing.status === 'In Progress') {
        return res.json({
          attemptId: existing.attempt_id,
          invitationId: invitationId,
          status: existing.status,
          startedAt: existing.started_at
        });
      }

      // Completed: do not allow a second attempt
      if (existing.status === 'Completed') {
        return res.status(400).json({ error: 'Assessment has already been completed for this invitation' });
      }
    }

    // 4. Create new In Progress attempt
    // Numeric suffix from timestamp keeps attempt_id within varchar(10)
    const suffix = Date.now().toString().slice(-6);
    const newAttemptId = 'ATT-' + suffix;

    await query(`
      INSERT INTO assessment_attempt (attempt_id, invitation_id, started_at, status)
      VALUES ($1, $2, CURRENT_TIMESTAMP, 'In Progress')
    `, [newAttemptId, invitationId]);

    const created = await query(`
      SELECT attempt_id, invitation_id, status, started_at
      FROM assessment_attempt
      WHERE attempt_id = $1
    `, [newAttemptId]);

    const row = created.rows[0];
    res.status(201).json({
      attemptId: row.attempt_id,
      invitationId: row.invitation_id,
      status: row.status,
      startedAt: row.started_at
    });

  } catch (err) {
    console.error(`[Assessments] Error starting attempt for ${req.params.invitationId}:`, err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/assessments/:attemptId/responses
router.post('/:attemptId/responses', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, optionId } = req.body;

    if (!questionId || !optionId) {
      return res.status(400).json({ error: 'questionId and optionId are required' });
    }

    // 1. Verify attempt exists and get its assessment form ID
    const attemptResult = await query(`
      SELECT att.attempt_id, inv.assessment_form_id
      FROM assessment_attempt att
      JOIN assessment_invitation inv ON att.invitation_id = inv.invitation_id
      WHERE att.attempt_id = $1
    `, [attemptId]);

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    const formId = attemptResult.rows[0].assessment_form_id;

    // 2. Verify question belongs to the assessment being attempted
    const questionResult = await query(`
      SELECT question_id 
      FROM form_question 
      WHERE assessment_form_id = $1 AND question_id = $2
    `, [formId, questionId]);

    if (questionResult.rows.length === 0) {
      return res.status(400).json({ error: 'Question does not belong to this assessment' });
    }

    // 3. Verify option belongs to the question and get its score
    const optionResult = await query(`
      SELECT option_id, score_value 
      FROM question_option 
      WHERE question_id = $1 AND option_id = $2
    `, [questionId, optionId]);

    if (optionResult.rows.length === 0) {
      return res.status(400).json({ error: 'Option does not belong to this question' });
    }
    const scoreAwarded = optionResult.rows[0].score_value;

    // 4. Handle Insert/Update
    // Since there's no DB-level unique constraint on (attempt_id, question_id), 
    // we manually check to prevent duplicates.
    const existingResult = await query(`
      SELECT response_id 
      FROM candidate_response 
      WHERE attempt_id = $1 AND question_id = $2
    `, [attemptId, questionId]);

    if (existingResult.rows.length > 0) {
      // Update existing
      const responseId = existingResult.rows[0].response_id;
      await query(`
        UPDATE candidate_response 
        SET selected_option_id = $1, score_awarded = $2 
        WHERE response_id = $3
      `, [optionId, scoreAwarded, responseId]);

      return res.json({ success: true, action: 'updated', responseId });
    } else {
      // Insert new
      const crypto = require('crypto');
      const newResponseId = 'RESP-' + crypto.randomUUID().slice(0, 7);
      const responseTime = 0; // Defaulting to 0 since frontend doesn't provide it yet

      await query(`
        INSERT INTO candidate_response 
        (response_id, attempt_id, question_id, selected_option_id, score_awarded, response_time_seconds)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [newResponseId, attemptId, questionId, optionId, scoreAwarded, responseTime]);

      return res.json({ success: true, action: 'inserted', responseId: newResponseId });
    }

  } catch (err) {
    console.error(`[Responses] Error saving response for attempt ${req.params.attemptId}:`, err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/assessments/:attemptId/submit
router.post('/:attemptId/submit', async (req, res) => {
  const client = await pool.connect();
  try {
    const { attemptId } = req.params;
    const { timedOut } = req.body;
    
    await client.query('BEGIN');
    
    // 1. Verify attempt exists
    const attemptResult = await client.query(`
      SELECT att.status, att.started_at, att.invitation_id,
             inv.assessment_form_id
      FROM assessment_attempt att
      JOIN assessment_invitation inv ON att.invitation_id = inv.invitation_id
      WHERE att.attempt_id = $1
    `, [attemptId]);

    if (attemptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Attempt not found' });
    }
    
    const attempt = attemptResult.rows[0];
    
    if (attempt.status === 'Completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Assessment has already been completed' });
    }
    
    // 2. Calculate score and stats
    const formResult = await client.query(`
      SELECT av.maximum_score, av.total_questions
      FROM assessment_form af
      JOIN assessment_version av ON af.assessment_version_id = av.assessment_version_id
      WHERE af.assessment_form_id = $1
    `, [attempt.assessment_form_id]);
    
    if (formResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Assessment form details not found' });
    }
    
    const maxScore = Number(formResult.rows[0].maximum_score) || 0;
    const totalQuestions = Number(formResult.rows[0].total_questions) || 0;
    
    const responseResult = await client.query(`
      SELECT COALESCE(SUM(score_awarded), 0) as raw_score,
             COUNT(question_id) as answered_questions
      FROM candidate_response
      WHERE attempt_id = $1
    `, [attemptId]);
    
    const rawScore = Number(responseResult.rows[0].raw_score) || 0;
    const answered = Number(responseResult.rows[0].answered_questions) || 0;
    const unanswered = Math.max(0, totalQuestions - answered);
    
    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    
    const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const submissionType = timedOut ? 'Time Expired' : 'Candidate Submitted';
    
    // 3. Update attempt
    await client.query(`
      UPDATE assessment_attempt
      SET status = 'Completed',
          submitted_at = CURRENT_TIMESTAMP,
          time_taken_seconds = $1,
          submission_type = $2,
          answered_questions = $3,
          unanswered_questions = $4,
          raw_score = $5,
          maximum_score = $6,
          percentage_score = $7
      WHERE attempt_id = $8
    `, [timeTaken, submissionType, answered, unanswered, rawScore, maxScore, percentage, attemptId]);
    
    // 4. Update invitation
    await client.query(`
      UPDATE assessment_invitation
      SET invitation_status = 'Completed'
      WHERE invitation_id = $1
    `, [attempt.invitation_id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Assessment submitted successfully',
      percentageScore: percentage,
      rawScore,
      maxScore,
      timeTaken
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Assessments] Error submitting attempt:', err.message);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

// POST /api/assessments — create a complete new assessment
router.post('/', async (req, res) => {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  const client = await pool.connect();
  try {
    const { title, duration, passingScore, status, questions } = req.body;

    // Basic validation
    if (!title || !title.trim()) return res.status(400).json({ error: 'Assessment name is required' });
    if (!duration || duration < 1) return res.status(400).json({ error: 'Duration must be at least 1 minute' });
    if (!passingScore || passingScore < 1 || passingScore > 100) return res.status(400).json({ error: 'Passing score must be 1–100' });
    if (!questions || questions.length === 0) return res.status(400).json({ error: 'At least one question is required' });
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.questionText.trim()) return res.status(400).json({ error: `Question ${i + 1} text is empty` });
      if (q.options && q.options.length > 4) return res.status(400).json({ error: `Question ${i + 1}: maximum 4 options allowed` });
    }

    await client.query('BEGIN');

    // ── ID generation helpers ────────────────────────────────────────────────
    const ts = Date.now().toString().slice(-6);
    const rand = () => Math.random().toString(36).slice(2, 5).toUpperCase();

    // ── Compute aggregates ────────────────────────────────────────────────────
    const totalQuestions = questions.length;
    const maximumScore = questions.reduce((sum, q) => sum + (Number(q.scoreValue) || 0), 0);

    // ── 1. assessment_version ────────────────────────────────────────────────
    const avId = `AV-${ts}`;
    await client.query(`
      INSERT INTO assessment_version
        (assessment_version_id, version_number, duration_minutes, total_questions,
         maximum_score, passing_percentage, assessment_weight, effective_from, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
    `, [avId, 1, duration, totalQuestions, maximumScore, passingScore, 1.0, status || 'Active']);

    // ── 2. assessment_form ───────────────────────────────────────────────────
    const afId = `FORM-${ts}`;
    await client.query(`
      INSERT INTO assessment_form
        (assessment_form_id, assessment_version_id, form_code, status)
      VALUES ($1, $2, $3, $4)
    `, [afId, avId, title.trim(), status || 'Active']);

    // ── 3. questions + options + form_question ───────────────────────────────
    const LABELS = ['A', 'B', 'C', 'D'];
    // Map frontend questionType to DB-allowed values
    const mapType = type => {
      if (type === 'likert' || type === 'behavioral') {
        return 'Behavioral Scenario';
      }

      return 'Aptitude MCQ';
    };

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = String(i + 1).padStart(2, '0');
      const qId = `Q-${ts}${qNum}`; // 2 + 6 + 2 = 10 chars (max 10)
      const qCode = `${afId}-Q${i + 1}`; // e.g. FORM-123456-Q1 (max 20)

      await client.query(`
        INSERT INTO question
          (question_id, assessment_version_id, question_code, question_text, question_type,
           difficulty_level, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'Medium', 'Active', CURRENT_TIMESTAMP)
      `, [qId, avId, qCode, q.questionText.trim(), mapType(q.questionType)]);

      const opts = q.options || [];
      for (let j = 0; j < Math.min(opts.length, 4); j++) {
        const opt = opts[j];
        const optId = `OP${ts}${qNum}${LABELS[j]}`; // 2 + 6 + 2 + 1 = 11 chars (max 15)
        await client.query(`
          INSERT INTO question_option (option_id, question_id, option_label, option_text, score_value)
          VALUES ($1, $2, $3, $4, $5)
        `, [optId, qId, LABELS[j], opt.text, Number(opt.scoreValue) || 0]);
      }

      const fqId = `FQ-${ts}${qNum}`; // 3 + 6 + 2 = 11 chars (max 15)
      await client.query(`
        INSERT INTO form_question (form_question_id, assessment_form_id, question_id, question_number, question_weight)
        VALUES ($1, $2, $3, $4, $5)
      `, [fqId, afId, qId, i + 1, Number(q.scoreValue) || 0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      id: afId,
      assessmentVersionId: avId,
      formCode: title.trim(),
      message: 'Assessment created successfully'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Assessments] Error creating assessment:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

module.exports = router;
