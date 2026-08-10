'use strict';

const express = require('express');
const { query } = require('../db');

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
          attemptId:    existing.attempt_id,
          invitationId: invitationId,
          status:       existing.status,
          startedAt:    existing.started_at
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
      attemptId:    row.attempt_id,
      invitationId: row.invitation_id,
      status:       row.status,
      startedAt:    row.started_at
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

module.exports = router;
