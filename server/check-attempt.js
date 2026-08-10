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
    const cols = await c.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'assessment_attempt'");
    console.log('--- columns ---', cols.rows);
    
    const cons = await c.query("SELECT conname, pg_get_constraintdef(c.oid) as condef FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'assessment_attempt'");
    console.log('--- constraints ---', cons.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
