'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 *
 * Returns aggregated dashboard statistics at the candidate level
 * so the stat cards match the candidate table view.
 */
router.get('/stats', async (req, res) => {
  try {
    const totalResult = await query('SELECT COUNT(*) as count FROM candidate_account');
    const totalApplicants = parseInt(totalResult.rows[0].count);

    const assignedResult = await query(`
      SELECT COUNT(DISTINCT a.candidate_id) as count
      FROM assessment_invitation inv
      JOIN application a ON inv.application_id = a.application_id
    `);
    const assigned = parseInt(assignedResult.rows[0].count);

    const completedResult = await query(`
      SELECT COUNT(DISTINCT a.candidate_id) as count
      FROM assessment_attempt att
      JOIN assessment_invitation inv ON att.invitation_id = inv.invitation_id
      JOIN application a ON inv.application_id = a.application_id
      WHERE att.status = 'Completed' OR inv.invitation_status = 'Completed'
    `);
    const completedCount = parseInt(completedResult.rows[0].count);

    const pendingResult = await query(`
      SELECT COUNT(DISTINCT a.candidate_id) as count
      FROM assessment_invitation inv
      JOIN application a ON inv.application_id = a.application_id
      LEFT JOIN assessment_attempt att ON inv.invitation_id = att.invitation_id
      WHERE att.attempt_id IS NULL OR (att.status != 'Completed' AND inv.invitation_status != 'Completed')
    `);
    const pending = parseInt(pendingResult.rows[0].count);

    const passFailResult = await query(`
      WITH latest_completed AS (
        SELECT
          a.candidate_id,
          att.percentage_score,
          av.passing_percentage,
          ROW_NUMBER() OVER (PARTITION BY a.candidate_id ORDER BY inv.opened_at DESC NULLS LAST) as rn
        FROM assessment_attempt att
        JOIN assessment_invitation inv ON att.invitation_id = inv.invitation_id
        JOIN application a ON inv.application_id = a.application_id
        JOIN assessment_form af ON inv.assessment_form_id = af.assessment_form_id
        JOIN assessment_version av ON af.assessment_version_id = av.assessment_version_id
        WHERE att.status = 'Completed' OR inv.invitation_status = 'Completed'
      )
      SELECT
        COUNT(*) FILTER (WHERE percentage_score >= passing_percentage) as passed,
        COUNT(*) FILTER (WHERE percentage_score < passing_percentage) as failed
      FROM latest_completed
      WHERE rn = 1
    `);
    const passed = parseInt(passFailResult.rows[0].passed) || 0;
    const failed = parseInt(passFailResult.rows[0].failed) || 0;

    const scoreResult = await query(`
      WITH latest_completed AS (
        SELECT
          a.candidate_id,
          att.percentage_score,
          att.time_taken_seconds,
          ROW_NUMBER() OVER (PARTITION BY a.candidate_id ORDER BY inv.opened_at DESC NULLS LAST) as rn
        FROM assessment_attempt att
        JOIN assessment_invitation inv ON att.invitation_id = inv.invitation_id
        JOIN application a ON inv.application_id = a.application_id
        WHERE att.status = 'Completed' OR inv.invitation_status = 'Completed'
      )
      SELECT
        AVG(percentage_score) as avg_score,
        MAX(percentage_score) as highest,
        MIN(percentage_score) as lowest,
        AVG(time_taken_seconds) as avg_time
      FROM latest_completed
      WHERE rn = 1 AND percentage_score IS NOT NULL
    `);
    const avgScore = scoreResult.rows[0].avg_score ? Math.round(parseFloat(scoreResult.rows[0].avg_score)) : null;
    const highest = scoreResult.rows[0].highest ? Math.round(parseFloat(scoreResult.rows[0].highest)) : null;
    const lowest = scoreResult.rows[0].lowest ? Math.round(parseFloat(scoreResult.rows[0].lowest)) : null;
    const avgTime = scoreResult.rows[0].avg_time ? Math.round(parseFloat(scoreResult.rows[0].avg_time)) : null;

    const appStatusResult = await query(`
      SELECT
        COUNT(DISTINCT CASE WHEN application_status IN ('Interview', 'Selected', 'Hired') THEN candidate_id END) as interviewed,
        COUNT(DISTINCT CASE WHEN application_status IN ('Hired', 'Selected') THEN candidate_id END) as hired
      FROM application
    `);
    const interviewed = parseInt(appStatusResult.rows[0].interviewed) || 0;
    const hired = parseInt(appStatusResult.rows[0].hired) || 0;

    return res.json({
      totalApplicants,
      assigned,
      completedCount,
      pending,
      passed,
      failed,
      avgScore,
      highest,
      lowest,
      avgTime,
      interviewed,
      hired,
      funnel: {
        applied: totalApplicants,
        assigned,
        completed: completedCount,
        passed,
        interview: interviewed,
        selected: hired
      }
    });

  } catch (err) {
    console.error('[Dashboard] Error fetching stats:', err.message);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
