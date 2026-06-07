const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../utils/initDatabase');
const { createSession, deleteSession, authenticate, requireParent } = require('../middleware/auth');

const router = express.Router();

router.get('/profiles', (req, res) => {
  const db = getDb();
  const profiles = db.prepare(`
    SELECT id, username, role, name, avatar, color,
           CASE WHEN pin_hash IS NOT NULL AND pin_hash != '' THEN 1 ELSE 0 END as pin_required
    FROM users
    ORDER BY role DESC, name ASC
  `).all();
  res.json(profiles);
});

router.post('/login', (req, res) => {
  const { username, pin } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Profile not found' });

  if (user.pin_hash && user.pin_hash !== '') {
    if (!pin) return res.status(401).json({ error: 'PIN required' });
    const valid = bcrypt.compareSync(String(pin), user.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Wrong PIN' });
  }

  const session = createSession(user.id, user.role);
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      avatar: user.avatar,
      color: user.color
    }
  });
});

router.post('/logout', authenticate, (req, res) => {
  deleteSession(req.user.token);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, name, avatar, color FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.post('/change-pin', authenticate, (req, res) => {
  const { currentPin, newPin } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  if (user.pin_hash && user.pin_hash !== '') {
    if (!currentPin || !bcrypt.compareSync(String(currentPin), user.pin_hash)) {
      return res.status(401).json({ error: 'Current PIN incorrect' });
    }
  }

  const newHash = newPin && String(newPin).length > 0 ? bcrypt.hashSync(String(newPin), 10) : '';
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
