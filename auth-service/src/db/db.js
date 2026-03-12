const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'taskboard',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
});

pool.on('connect', () => console.log('[auth-service] DB connected'));
pool.on('error',   (err) => console.error('[auth-service] DB error', err));

module.exports = { pool };