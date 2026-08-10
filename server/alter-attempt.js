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
    await c.query('BEGIN');
    
    // Check historical data before
    const beforeCount = await c.query("SELECT COUNT(*) FROM assessment_attempt");
    const beforeData = await c.query("SELECT * FROM assessment_attempt WHERE attempt_id = 'ATT-0001'");
    
    // Modify status constraint
    await c.query("ALTER TABLE assessment_attempt DROP CONSTRAINT assessment_attempt_status_check");
    await c.query("ALTER TABLE assessment_attempt ADD CONSTRAINT assessment_attempt_status_check CHECK (status IN ('Completed', 'In Progress'))");

    // Drop NOT NULLs
    const cols = [
      'submitted_at', 'time_taken_seconds', 'submission_type',
      'answered_questions', 'unanswered_questions', 'raw_score',
      'maximum_score', 'percentage_score'
    ];
    for (const col of cols) {
      await c.query(`ALTER TABLE assessment_attempt ALTER COLUMN ${col} DROP NOT NULL`);
    }

    // Verify historical data after
    const afterCount = await c.query("SELECT COUNT(*) FROM assessment_attempt");
    const afterData = await c.query("SELECT * FROM assessment_attempt WHERE attempt_id = 'ATT-0001'");
    
    let historicalSafe = (beforeCount.rows[0].count === afterCount.rows[0].count);
    
    // Test inserting an In Progress attempt
    await c.query(`
      INSERT INTO assessment_attempt (attempt_id, invitation_id, started_at, status)
      VALUES ('ATT-TEST2', $1, NOW(), 'In Progress')
    `, [beforeData.rows[0].invitation_id]);
    
    // Clean up test data
    await c.query("DELETE FROM assessment_attempt WHERE attempt_id = 'ATT-TEST2'");

    await c.query('COMMIT');
    
    console.log('Schema changes applied successfully.');
    console.log('Historical data safe:', historicalSafe);
    
  } catch(e) {
    await c.query('ROLLBACK');
    console.error('Error applying changes (Rolled back):', e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
