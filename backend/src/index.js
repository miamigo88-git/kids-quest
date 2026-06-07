require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { initializeDatabase, getDb } = require('./utils/initDatabase');
const authRoutes = require('./routes/auth');
const kidsRoutes = require('./routes/kids');
const tasksRoutes = require('./routes/tasks');
const scoresRoutes = require('./routes/scores');
const { cleanupSessions } = require('./middleware/auth');

initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '../../frontend/public');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/kids', kidsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/scores', scoresRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(express.static(STATIC_DIR, { extensions: ['html'] }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

cron.schedule('0 * * * *', () => {
  try { cleanupSessions(); } catch (e) { console.error('Cleanup error:', e); }
});

cron.schedule('1 0 * * *', () => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const kids = db.prepare("SELECT id FROM users WHERE role = 'kid'").all();
    const { v4: uuidv4 } = require('uuid');
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO daily_scores (id, user_id, date, total_points, completed_tasks, total_tasks, completion_rate, cat_mood)
      VALUES (?, ?, ?, 0, 0, 0, 0, 'sleepy')
    `);
    kids.forEach(k => insertStmt.run(uuidv4(), k.id, today));
    console.log('[cron] New day initialized for', kids.length, 'kids');
  } catch (e) {
    console.error('Daily reset error:', e);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kids Quest server running on port ${PORT}`);
  console.log(`Frontend: ${STATIC_DIR}`);
});
