const express = require('express');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.set('trust proxy', 1);

app.use('/api/tasks', require('./routes/task'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[task-service] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`[task-service] listening on port ${PORT}`));