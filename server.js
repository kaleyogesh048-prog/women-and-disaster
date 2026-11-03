const express = require('express');
const cors = require('cors');
const config = require('./config');
const { errorHandler } = require('./middleware');

const app = express();
app.set('trust proxy', 1); // needed when hosted on Render / Railway etc.

app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/sos', require('./routes/sos'));
app.use('/api/ai', require('./routes/ai'));

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use(errorHandler);

if (config.jwtSecret === 'change-this-secret') {
  console.warn('Warning: set a real JWT_SECRET in .env before going live');
}

app.listen(config.port, () => {
  console.log(`SafeShield backend running on http://localhost:${config.port}`);
  console.log(`SMS provider: ${config.smsProvider}`);
});
