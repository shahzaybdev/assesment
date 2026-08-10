require('dotenv').config();
const {Pool} = require('pg');
const crypto = require('crypto');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000
});

async function run() {
  const c = await pool.connect();
  try {
    // Clone fake attempt dynamically
    const newAttemptId = 'ATT-TEST1';
    const attRow = await c.query("SELECT * FROM assessment_attempt WHERE attempt_id = 'ATT-0001'");
    const attData = attRow.rows[0];
    attData.attempt_id = newAttemptId;
    
    const cols = Object.keys(attData);
    const vals = Object.values(attData);
    const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
    
    await c.query(`INSERT INTO assessment_attempt (${cols.join(', ')}) VALUES (${placeholders})`, vals);
    console.log('Created fake attempt:', newAttemptId);

    // Get the invitation id of ATT-0001 to get its form id
    const inv = await c.query("SELECT invitation_id, assessment_form_id FROM assessment_invitation WHERE invitation_id = $1", [attData.invitation_id]);
    const invId = inv.rows[0].invitation_id;
    const formId = inv.rows[0].assessment_form_id;

    // Get a valid question and option
    const qs = await c.query(`
      SELECT fq.question_id, qo.option_id 
      FROM form_question fq
      JOIN question_option qo ON qo.question_id = fq.question_id
      WHERE fq.assessment_form_id = $1 LIMIT 1
    `, [formId]);
    const validQ = qs.rows[0].question_id;
    const validO = qs.rows[0].option_id;

    // Get an INVALID question (from another form)
    const invalidQRes = await c.query("SELECT question_id FROM form_question WHERE assessment_form_id != $1 LIMIT 1", [formId]);
    const invalidQ = invalidQRes.rows[0]?.question_id || 'INVALID-Q';

    console.log('Valid Q/O:', validQ, validO);
    console.log('Invalid Q:', invalidQ);

    // Now test the API
    const http = require('http');

    const makeReq = (data, pathStr) => {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3000,
          path: pathStr,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
      });
    };

    const path = `/api/assessments/${newAttemptId}/responses`;
    
    // 1. Valid question + valid option
    let r1 = await makeReq({ questionId: validQ, optionId: validO }, path);
    console.log('Test 1 (Valid):', r1);

    // 5. Duplicate response behavior (should UPDATE)
    let r5 = await makeReq({ questionId: validQ, optionId: validO }, path);
    console.log('Test 5 (Duplicate):', r5);

    // 2. Invalid attempt ID
    let r2 = await makeReq({ questionId: validQ, optionId: validO }, '/api/assessments/INVALID-ATT/responses');
    console.log('Test 2 (Invalid Attempt):', r2);

    // 3. Invalid question ID (does not belong to this form)
    let r3 = await makeReq({ questionId: invalidQ, optionId: validO }, path);
    console.log('Test 3 (Question mismatch):', r3);

    // 4. Option belonging to another question
    let r4 = await makeReq({ questionId: validQ, optionId: 'INVALID-O' }, path);
    console.log('Test 4 (Option mismatch):', r4);

    // Clean up
    console.log('Cleaning up mock data...');
    await c.query("DELETE FROM candidate_response WHERE attempt_id = $1", [newAttemptId]);
    await c.query("DELETE FROM assessment_attempt WHERE attempt_id = $1", [newAttemptId]);
    console.log('Done.');

  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
