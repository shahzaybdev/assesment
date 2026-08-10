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
    // Check expires_at range
    const exp = await c.query("SELECT MIN(expires_at), MAX(expires_at), NOW() as now FROM assessment_invitation");
    console.log('Expiry range:', exp.rows[0]);

    // Find invitations with no attempt
    const fresh = await c.query(`
      SELECT inv.invitation_id, inv.expires_at, inv.invitation_status
      FROM assessment_invitation inv
      LEFT JOIN assessment_attempt att ON att.invitation_id = inv.invitation_id
      WHERE att.attempt_id IS NULL
      LIMIT 5
    `);
    console.log('Fresh invitations (no attempt):', fresh.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
