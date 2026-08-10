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
    const idx = await c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'candidate_response'");
    console.log('--- indexes ---', idx.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    c.release();
    await pool.end();
  }
}
run();
