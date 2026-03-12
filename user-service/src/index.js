const express = require('express');
const app = express();
const PORT = process.env.PORT || 3003;
app.use(express.json());
app.set('trust proxy', 1);
app.use('/api/users', require('./routes/users'));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, () => console.log(`[user-service] listening on port ${PORT}`));
