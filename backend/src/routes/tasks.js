const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../utils/initDatabase');
const { authenticate, requireParent } = require('../middleware/auth');

const router = express.Router();

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function moodForRate(rate) {
  if (rate >= 1.0) return 'ecstatic';
  if (rate >= 0.8) return 'happy';
  if (rate >= 0.5) return 'content';
  if (rate >= 0.25) return 'neutral';
  if (rate > 0) return 'sad';
  return 'sleepy';
}

function recomputeDailyScore(userId, date) {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.id, t.points,
           (SELECT 1 FROM task_completions c WHERE c.task_id = t.id AND c.user_id = ? AND c.date = ?) as done
    FROM tasks t
    WHERE t.assigned_to = ? AND t.active = 1
      AND (t.is_default = 1 OR t.specific_date = ?)
  `).all(userId, date, userId, date);

  const total = tasks.length;
  const completed = tasks.filter(t => t.done).length;
  const points = tasks.filter(t => t.done).reduce((sum, t) => sum + (t.points || 0), 0);
  const rate = total > 0 ? completed / total : 0;
  const mood = moodForRate(rate);

  const existing = db.prepare('SELECT id FROM daily_scores WHERE user_id = ? AND date = ?').get(userId, date);
  if (existing) {
    db.prepare(`
      UPDATE daily_scores SET total_points = ?, completed_tasks = ?, total_tasks = ?,
        completion_rate = ?, cat_mood = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(points, completed, total, rate, mood, existing.id);
  } else {
    db.prepare(`
      INSERT INTO daily_scores (id, user_id, date, total_points, completed_tasks, total_tasks, completion_rate, cat_mood)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, date, points, completed, total, rate, mood);
  }

  return { total_points: points, completed_tasks: completed, total_tasks: total, completion_rate: rate, cat_mood: mood };
}

router.get('/kid/:kidId', authenticate, (req, res) => {
  const db = getDb();
  const date = req.query.date || todayStr();
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date' });

  const kid = db.prepare("SELECT id, name, avatar, color FROM users WHERE id = ? AND role = 'kid'").get(req.params.kidId);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  if (req.user.role === 'kid' && req.user.id !== kid.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.description, t.icon, t.category, t.points, t.is_default, t.specific_date,
           c.id as completion_id, c.completed_at, c.points_earned
    FROM tasks t
    LEFT JOIN task_completions c ON c.task_id = t.id AND c.user_id = ? AND c.date = ?
    WHERE t.assigned_to = ? AND t.active = 1
      AND (t.is_default = 1 OR t.specific_date = ?)
    ORDER BY t.is_default DESC, t.created_at ASC
  `).all(kid.id, date, kid.id, date);

  const score = recomputeDailyScore(kid.id, date);

  res.json({ kid, date, tasks, score });
});

router.post('/', authenticate, requireParent, (req, res) => {
  const { title, description, icon, category, points, assigned_to, is_default, specific_date } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title required' });
  if (!assigned_to) return res.status(400).json({ error: 'assigned_to required' });
  if (specific_date && !validDate(specific_date)) return res.status(400).json({ error: 'Invalid date' });

  const db = getDb();
  const kid = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'kid'").get(assigned_to);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (id, title, description, icon, category, is_default, assigned_to, created_by, specific_date, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(title).trim(),
    description || '',
    icon || '⭐',
    category || 'daily',
    is_default ? 1 : 0,
    assigned_to,
    req.user.id,
    is_default ? null : (specific_date || todayStr()),
    Number(points) || 10
  );

  if (!is_default) {
    recomputeDailyScore(assigned_to, specific_date || todayStr());
  }

  res.status(201).json({ id });
});

router.put('/:id', authenticate, requireParent, (req, res) => {
  const { title, description, icon, category, points, active } = req.body;
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updates = [];
  const params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(String(title).trim()); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description || ''); }
  if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (points !== undefined) { updates.push('points = ?'); params.push(Number(points) || 10); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (updates.length === 0) return res.json({ ok: true });

  params.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  recomputeDailyScore(task.assigned_to, todayStr());
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireParent, (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  recomputeDailyScore(task.assigned_to, todayStr());
  res.json({ ok: true });
});

router.post('/:id/complete', authenticate, (req, res) => {
  const date = req.body.date || todayStr();
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date' });

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND active = 1').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'kid' && req.user.id !== task.assigned_to) {
    return res.status(403).json({ error: 'Not your task' });
  }

  const userId = task.assigned_to;
  const existing = db.prepare('SELECT id FROM task_completions WHERE task_id = ? AND user_id = ? AND date = ?')
    .get(task.id, userId, date);

  if (!existing) {
    db.prepare(`
      INSERT INTO task_completions (id, task_id, user_id, date, points_earned)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), task.id, userId, date, task.points);
  }

  const score = recomputeDailyScore(userId, date);
  res.json({ ok: true, score });
});

router.post('/:id/uncomplete', authenticate, (req, res) => {
  const date = req.body.date || todayStr();
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date' });

  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.user.role === 'kid' && req.user.id !== task.assigned_to) {
    return res.status(403).json({ error: 'Not your task' });
  }

  db.prepare('DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND date = ?')
    .run(task.id, task.assigned_to, date);

  const score = recomputeDailyScore(task.assigned_to, date);
  res.json({ ok: true, score });
});

router.post('/seed-defaults/:kidId', authenticate, requireParent, (req, res) => {
  const db = getDb();
  const kid = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'kid'").get(req.params.kidId);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  const defaultTasks = [
    { title: 'Brush Teeth', icon: '🪥', category: 'hygiene', points: 10 },
    { title: 'Make Bed', icon: '🛏️', category: 'chores', points: 10 },
    { title: 'Read a Book', icon: '📚', category: 'learning', points: 15 },
    { title: 'Do Homework', icon: '✏️', category: 'learning', points: 20 },
    { title: 'Tidy Room', icon: '🧸', category: 'chores', points: 15 },
    { title: 'Eat Veggies', icon: '🥦', category: 'health', points: 10 },
    { title: 'Drink Water', icon: '💧', category: 'health', points: 10 },
    { title: 'Play Outside', icon: '⚽', category: 'health', points: 15 },
    { title: 'Help at Home', icon: '🧹', category: 'chores', points: 10 },
    { title: 'Be Kind', icon: '💖', category: 'behavior', points: 10 }
  ];

  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, icon, category, is_default, assigned_to, created_by, points)
    VALUES (?, ?, '', ?, ?, 1, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    items.forEach(t => stmt.run(uuidv4(), t.title, t.icon, t.category, kid.id, req.user.id, t.points));
  });
  insertMany(defaultTasks);

  res.json({ ok: true, count: defaultTasks.length });
});

module.exports = router;
