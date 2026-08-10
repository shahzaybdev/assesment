require('dotenv').config();
const {Pool} = require('pg');
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
    const res = await c.query("SELECT attempt_id, invitation_id FROM assessment_attempt WHERE status != 'Completed' LIMIT 1");
    if(res.rows.length === 0) {
      console.log('No in-progress attempts found.');
    } else {
      console.log('Safe Attempt:', res.rows[0]);
      
      const att = res.rows[0];
      const qs = await c.query("SELECT fq.question_id, qo.option_id, fq.assessment_form_id FROM form_question fq JOIN assessment_invitation inv ON fq.assessment_form_id = inv.assessment_form_id JOIN question_option qo ON qo.question_id = fq.question_id WHERE inv.invitation_id = $1 LIMIT 1", [att.invitation_id]);
      console.log('Safe Question/Option:', qs.rows[0]);
    }
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
