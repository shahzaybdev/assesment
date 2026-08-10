const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Test 1: Start fresh attempt for INV-0039
  const t1 = await request('POST', '/api/assessments/INV-0039/start', {});
  console.log('T1 Start (new):', t1.status, t1.body);
  const attemptId = t1.body.attemptId;

  // Test 2: Idempotent — same attempt returned
  const t2 = await request('POST', '/api/assessments/INV-0039/start', {});
  console.log('T2 Start (idempotent):', t2.status, t2.body);
  console.log('  Same attemptId?', t1.body.attemptId === t2.body.attemptId);

  // Test 3: Save a response using the returned attemptId
  // Get a valid question/option for the form linked to INV-0039
  const assessData = await request('GET', `/api/candidates/HOT001/assessments`, null);
  
  // Use a direct DB lookup via the /assessments/:id endpoint on INV-0039's form
  // First get the form ID from the start response - we need to look it up via assessments
  // We know from our check that INV-0039 -> FORM-AP-05
  const formData = await request('GET', '/api/assessments/FORM-AP-05', null);
  const firstQ = formData.body.questions[0];
  const firstOpt = firstQ.options[0];
  
  console.log('Using Q:', firstQ.id, 'Opt:', firstOpt.id);
  
  const t3 = await request('POST', `/api/assessments/${attemptId}/responses`, {
    questionId: firstQ.id,
    optionId: firstOpt.id
  });
  console.log('T3 Save response:', t3.status, t3.body);

  // Test 4: Historical completed data unchanged
  const hist = await request('GET', '/api/assessments/FORM-AP-01', null);
  console.log('T4 Historical assessment still loads:', hist.status === 200);

  console.log('\n--- CLEANUP ---');
  return attemptId; // caller will clean up
}

run().then(async (attemptId) => {
  require('dotenv').config();
  const {Pool} = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  });
  const c = await pool.connect();
  try {
    const del1 = await c.query("DELETE FROM candidate_response WHERE attempt_id = $1 RETURNING response_id", [attemptId]);
    const del2 = await c.query("DELETE FROM assessment_attempt WHERE attempt_id = $1 AND status = 'In Progress' RETURNING attempt_id", [attemptId]);
    console.log('Deleted responses:', del1.rows);
    console.log('Deleted attempt:', del2.rows);
    const hist = await c.query("SELECT COUNT(*) FROM assessment_attempt WHERE status = 'Completed'");
    console.log('Historical completed rows still:', hist.rows[0].count);
  } finally {
    c.release();
    await pool.end();
  }
}).catch(console.error);
