const express  = require('express');
const bcrypt   = require('bcryptjs');
const { Pool } = require('pg');
const { generateToken, verifyToken } = require('../middleware/jwtUtils');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway ต้องใช้ SSL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // fallback สำหรับ local (ถ้าไม่มี DATABASE_URL)
  host:     process.env.DB_HOST     || 'auth-db',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'authdb',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'secret',
});

// ── Helper: ส่ง log ──────────────────────────────────────────────
async function logEvent(data) {
  try {
    const logUrl = process.env.LOG_SERVICE_URL || 'http://log-service:3003';
    await fetch(`${logUrl}/api/logs/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'auth-service', ...data })
    });
  } catch (_) {}
}

// ── Health ───────────────────────────────────────────────────────
router.get('/health', (_, res) => res.json({ status: 'ok', service: 'auth-service' }));

// ── T2: POST /api/auth/register → 201 + user ────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at`,
      [username, email.toLowerCase(), password_hash, role || 'member']
    );
    await logEvent({ level: 'INFO', event: 'REGISTER_SUCCESS',
      user_id: rows[0].id, method: 'POST', path: '/api/auth/register', status_code: 201,
      message: `User ${username} registered` });
    res.status(201).json({ message: 'Registration successful', user: rows[0] });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── T3: POST /api/auth/login → JWT ──────────────────────────────
router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'email/username and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [identifier.toLowerCase()]
    );
    const user = rows[0];
    const dummyHash = '$2b$10$invalidhashpaddinginvalidhashpaddinginvalidhash00000000';
    const isValid = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

    if (!user || !isValid) {
      await logEvent({ level: 'WARN', event: 'LOGIN_FAILED',
        method: 'POST', path: '/api/auth/login', status_code: 401,
        message: `Failed login for: ${identifier}` });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      sub: user.id, id: user.id,
      email: user.email, role: user.role, username: user.username
    });

    await logEvent({ level: 'INFO', event: 'LOGIN_SUCCESS', user_id: user.id,
      method: 'POST', path: '/api/auth/login', status_code: 200,
      message: `User ${user.username} logged in` });

    res.json({ message: 'Login successful', token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role } });

  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/verify ─────────────────────────────────────────
router.get('/verify', (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.json({ valid: false });
  try {
    const decoded = verifyToken(token);
    res.json({ valid: true, user: {
      id: decoded.sub || decoded.id, email: decoded.email,
      role: decoded.role, name: decoded.username, username: decoded.username
    }});
  } catch {
    res.json({ valid: false });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [decoded.sub || decoded.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;