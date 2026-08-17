// Pool Postgres + migrate() — Neon usa pooled connection
// Serverless: dorme após 5min, primeira query pode levar ~1s

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? false
    : { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Run each statement separately so IF NOT EXISTS handles idempotency
  const stmts = sql.split(/;\s*\n/).filter(s => s.trim());
  for (const stmt of stmts) {
    if (!stmt.trim()) continue;
    await pool.query(stmt + ';');
  }
}

module.exports = { pool, migrate };
