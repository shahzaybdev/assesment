'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/questions/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch question
    const qResult = await query(`
      SELECT 
        question_id AS id,
        question_text,
        question_type,
        difficulty_level
      FROM question
      WHERE question_id = $1
    `, [id]);

    if (qResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = qResult.rows[0];

    // 2. Fetch options
    const optResult = await query(`
      SELECT 
        option_id AS id,
        option_label AS label,
        option_text AS text,
        score_value
      FROM question_option
      WHERE question_id = $1
      ORDER BY option_label
    `, [id]);

    question.options = optResult.rows;

    res.json(question);

  } catch (err) {
    console.error(`[Questions] Error fetching ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
