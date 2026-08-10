/**
 * inspect-db.js — Read-only schema inspection (scratch script)
 * Run from server/ directory: node inspect-db.js
 */
'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
});

async function run() {
  const client = await pool.connect();
  try {

    // ── 1. All tables ─────────────────────────────────────────────────────────
    console.log('\n=== 1. ALL TABLES ===');
    const tables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    tables.rows.forEach(r => console.log(' *', r.table_name));

    // ── 2. Row counts ─────────────────────────────────────────────────────────
    console.log('\n=== 2. ROW COUNTS ===');
    for (const { table_name } of tables.rows) {
      const cnt = await client.query(`SELECT COUNT(*) FROM "${table_name}"`);
      console.log(' ', table_name.padEnd(45), cnt.rows[0].count, 'rows');
    }

    // ── 3. Columns per table ──────────────────────────────────────────────────
    console.log('\n=== 3. COLUMNS PER TABLE ===');
    for (const { table_name } of tables.rows) {
      const cols = await client.query(
        `SELECT
           c.column_name,
           c.data_type,
           c.is_nullable,
           CASE WHEN kcu.column_name IS NOT NULL THEN 'PK' ELSE '' END AS pk
         FROM information_schema.columns c
         LEFT JOIN information_schema.table_constraints tc
           ON tc.table_name = c.table_name
          AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
         LEFT JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name
          AND kcu.column_name = c.column_name
         WHERE c.table_name = $1 AND c.table_schema = 'public'
         ORDER BY c.ordinal_position`,
        [table_name]
      );
      console.log(`\n  --- ${table_name} ---`);
      cols.rows.forEach(col => {
        const pk = col.pk === 'PK' ? ' [PK]' : '     ';
        const nu = col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
        console.log(`    ${pk} ${col.column_name.padEnd(38)} ${col.data_type}${nu}`);
      });
    }

    // ── 4. Foreign keys ───────────────────────────────────────────────────────
    console.log('\n=== 4. FOREIGN KEYS ===');
    const fks = await client.query(
      `SELECT
         tc.table_name       AS from_table,
         kcu.column_name     AS from_col,
         ccu.table_name      AS to_table,
         ccu.column_name     AS to_col
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name`
    );
    fks.rows.forEach(fk =>
      console.log(`  ${fk.from_table}.${fk.from_col}  -->  ${fk.to_table}.${fk.to_col}`)
    );

    // ── 5. Sample rows from key tables ───────────────────────────────────────
    const KEY_TABLES = [
      'assessment_form', 'assessment_version', 'form_question',
      'question', 'question_option',
      'candidate_account', 'candidate_profile',
      'assessment_invitation', 'assessment_attempt',
      'candidate_response', 'dimension_score', 'overall_assessment_result',
    ];
    console.log('\n=== 5. SAMPLE ROWS FROM KEY TABLES (LIMIT 1) ===');
    const existingNames = new Set(tables.rows.map(r => r.table_name));
    for (const t of KEY_TABLES) {
      if (!existingNames.has(t)) {
        console.log(`\n  *** TABLE NOT FOUND: ${t} ***`);
        continue;
      }
      const sample = await client.query(`SELECT * FROM "${t}" LIMIT 1`);
      console.log(`\n  --- ${t} ---`);
      if (sample.rows.length === 0) {
        console.log('    (empty table)');
      } else {
        // Print keys and sanitized values
        const row = sample.rows[0];
        Object.entries(row).forEach(([k, v]) => {
          // Redact anything that looks like a password/hash
          const val = (k.includes('password') || k.includes('hash') || k.includes('secret'))
            ? '[REDACTED]'
            : String(v).slice(0, 120);
          console.log(`    ${k.padEnd(38)} = ${val}`);
        });
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Inspection failed:', err.message);
  process.exit(1);
});
