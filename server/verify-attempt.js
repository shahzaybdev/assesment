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
    // Check new status constraint
    const cons = await c.query("SELECT conname, pg_get_constraintdef(c.oid) as condef FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'assessment_attempt' AND conname = 'assessment_attempt_status_check'");
    console.log('Status constraint:', cons.rows[0]);
    
    // Check nullable fields
    const cols = await c.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'assessment_attempt' AND column_name IN ('submitted_at','time_taken_seconds','submission_type','answered_questions','unanswered_questions','raw_score','maximum_score','percentage_score')");
    console.log('Nullable fields:', cols.rows);
    
    // Check historical data unchanged
    const hist = await c.query("SELECT attempt_id, status, percentage_score, raw_score, started_at, submitted_at FROM assessment_attempt");
    console.log('Historical rows:', hist.rows);
    
    // Check PKs/FKs intact
    const fk = await c.query("SELECT conname, contype, pg_get_constraintdef(c.oid) as condef FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'assessment_attempt' AND contype IN ('p','f')");
    console.log('PKs/FKs intact:', fk.rows);

  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
