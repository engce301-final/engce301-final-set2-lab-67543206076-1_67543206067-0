const express     = require('express');
const { Pool }    = require('pg');
const requireAuth = require('../middleware/authMiddleware');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

router.get('/health', (_, res) => res.json({ status: 'ok', service: 'user-service' }));

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, bio, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  const { username, bio } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET username=COALESCE($1,username), bio=COALESCE($2,bio), updated_at=NOW()
       WHERE id=$3 RETURNING id, username, email, role, bio, updated_at`,
      [username||null, bio||null, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
