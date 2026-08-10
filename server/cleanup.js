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
    // Delete the test attempt created during Phase 9B testing
    const del = await c.query("DELETE FROM assessment_attempt WHERE invitation_id = 'INV-0039' AND status = 'In Progress' RETURNING attempt_id");
    console.log('Cleaned up test attempts:', del.rows);

    // Verify historical data unchanged
    const hist = await c.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'Completed') as completed FROM assessment_attempt");
    console.log('Historical data:', hist.rows[0]);

    // Spot-check ATT-0001
    const spot = await c.query("SELECT attempt_id, status, percentage_score, started_at FROM assessment_attempt WHERE attempt_id = 'ATT-0001'");
    console.log('ATT-0001 intact:', spot.rows[0]);
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
