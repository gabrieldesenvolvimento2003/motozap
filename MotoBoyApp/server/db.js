// Pool Postgres + migrate() — Neon usa pooled connection
// Serverless: dorme após 5min, primeira query pode levar ~1s

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? false : { rejectUnauthorized: false },
  max: 5,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, migrate };
