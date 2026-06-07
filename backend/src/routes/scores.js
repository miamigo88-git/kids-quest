const express = require('express');
const { getDb } = require('../utils/initDatabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(from, to) {
  const dates = [];
  const start = new Date(from);
  const end = new Date(to);
  while (start <= end) {
    dates.push(start.toISOString().slice(0, 10));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

router.get('/kid/:kidId', authenticate, (req, res) => {
  const db = getDb();
  const kid = db.prepare("SELECT id, name, avatar, color FROM users WHERE id = ? AND role = 'kid'").get(req.params.kidId);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  if (req.user.role === 'kid' && req.user.id !== kid.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const period = (req.query.period || 'week').toLowerCase();
  let days;
  if (period === 'week') days = 6;
  else if (period === 'month') days = 29;
  else if (period === 'year') days = 364;
  else days = parseInt(period, 10) || 6;

  const from = dateNDaysAgo(days);
  const to = todayStr();

  const rows = db.prepare(`
    SELECT date, total_points, completed_tasks, total_tasks, completion_rate, cat_mood
    FROM daily_scores
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(kid.id, from, to);

  const map = new Map(rows.map(r => [r.date, r]));
  const series = dateRange(from, to).map(date => {
    const r = map.get(date);
    return r || { date, total_points: 0, completed_tasks: 0, total_tasks: 0, completion_rate: 0, cat_mood: 'sleepy' };
  });

  const totals = series.reduce((acc, r) => {
    acc.points += r.total_points;
    acc.completed += r.completed_tasks;
    acc.tasks += r.total_tasks;
    return acc;
  }, { points: 0, completed: 0, tasks: 0 });

  const avgRate = totals.tasks > 0 ? totals.completed / totals.tasks : 0;

  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].total_tasks > 0 && series[i].completion_rate >= 1) streak++;
    else if (i === series.length - 1 && series[i].total_tasks === 0) continue;
    else break;
  }

  let bestDay = null;
  series.forEach(r => {
    if (!bestDay || r.total_points > bestDay.total_points) bestDay = r;
  });

  res.json({
    kid,
    period,
    from,
    to,
    series,
    totals: { ...totals, avgRate },
    streak,
    bestDay
  });
});

router.get('/leaderboard', authenticate, (req, res) => {
  const db = getDb();
  const period = (req.query.period || 'week').toLowerCase();
  let days = 6;
  if (period === 'month') days = 29;
  else if (period === 'year') days = 364;
  else if (period === 'today') days = 0;
  const from = dateNDaysAgo(days);

  const rows = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.color,
           COALESCE(SUM(s.total_points), 0) as points,
           COALESCE(SUM(s.completed_tasks), 0) as completed,
           COALESCE(SUM(s.total_tasks), 0) as tasks
    FROM users u
    LEFT JOIN daily_scores s ON s.user_id = u.id AND s.date >= ?
    WHERE u.role = 'kid'
    GROUP BY u.id
    ORDER BY points DESC, completed DESC
  `).all(from);

  res.json({ period, from, leaderboard: rows });
});

module.exports = router;
