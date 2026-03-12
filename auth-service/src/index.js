const express = require('express');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Trust proxy (สำหรับ rate limit ผ่าน nginx)
app.set('trust proxy', 1);

// Routes
app.use('/api/auth', require('./routes/auth'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[auth-service] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[auth-service] listening on port ${PORT}`);
});