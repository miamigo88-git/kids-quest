const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../utils/initDatabase');
const { authenticate, requireParent } = require('../middleware/auth');

const router = express.Router();

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30) || 'kid';
}

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const kids = db.prepare(`
    SELECT id, username, name, avatar, color,
           CASE WHEN pin_hash IS NOT NULL AND pin_hash != '' THEN 1 ELSE 0 END as pin_required,
           created_at
    FROM users WHERE role = 'kid' ORDER BY name ASC
  `).all();
  res.json(kids);
});

router.post('/', authenticate, requireParent, (req, res) => {
  const { name, avatar, color, pin } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name required' });

  const db = getDb();
  let username = slugify(name);
  let suffix = 1;
  while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    suffix++;
    username = `${slugify(name)}_${suffix}`;
  }

  const id = uuidv4();
  const pinHash = pin && String(pin).length > 0 ? bcrypt.hashSync(String(pin), 10) : '';

  db.prepare(`
    INSERT INTO users (id, username, pin_hash, role, name, avatar, color, parent_id)
    VALUES (?, ?, ?, 'kid', ?, ?, ?, ?)
  `).run(id, username, pinHash, String(name).trim(), avatar || '🐱', color || '#FFB6C1', req.user.id);

  res.status(201).json({ id, username, name, avatar: avatar || '🐱', color: color || '#FFB6C1' });
});

router.put('/:id', authenticate, requireParent, (req, res) => {
  const { name, avatar, color, pin } = req.body;
  const db = getDb();
  const kid = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'kid'").get(req.params.id);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(String(name).trim()); }
  if (avatar) { updates.push('avatar = ?'); params.push(avatar); }
  if (color) { updates.push('color = ?'); params.push(color); }
  if (pin !== undefined) {
    const pinHash = pin && String(pin).length > 0 ? bcrypt.hashSync(String(pin), 10) : '';
    updates.push('pin_hash = ?');
    params.push(pinHash);
  }
  if (updates.length === 0) return res.json({ ok: true });

  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireParent, (req, res) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'kid'").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Kid not found' });
  res.json({ ok: true });
});

module.exports = router;
