const express    = require('express');
const { Pool }   = require('pg');
const requireAuth = require('../middleware/authMiddleware');
 
const router = express.Router();
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
 
// Health
router.get('/health', (_, res) => res.json({ status: 'ok', service: 'user-service' }));
 
// GET /api/users/profile — ดู profile ตัวเอง (T6)
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, bio, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[user] GET profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
 
// PUT /api/users/profile — แก้ไข profile (T7)
router.put('/profile', requireAuth, async (req, res) => {
  const { username, bio } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         username   = COALESCE($1, username),
         bio        = COALESCE($2, bio),
         updated_at = NOW()
       WHERE id = $3 RETURNING id, username, email, role, bio, updated_at`,
      [username || null, bio || null, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    console.error('[user] PUT profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
 
// GET /api/users/ — ดู users ทั้งหมด (admin only)
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY id'
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
 
module.exports = router;