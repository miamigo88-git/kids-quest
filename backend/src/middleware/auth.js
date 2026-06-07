const { getDb } = require('../utils/initDatabase');
const crypto = require('crypto');

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function createSession(userId, role) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, role, expiresAt);
  return { token, expiresAt };
}

function deleteSession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function cleanupSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.query.token || null;
}

function authenticate(req, res, next) {
  cleanupSessions();
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No session token' });

  const session = getDb()
    .prepare("SELECT s.*, u.name as user_name, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')")
    .get(token);

  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

  req.user = {
    id: session.user_id,
    role: session.role,
    name: session.user_name,
    username: session.username,
    token
  };
  next();
}

function requireParent(req, res, next) {
  if (!req.user || req.user.role !== 'parent') {
    return res.status(403).json({ error: 'Parent access required' });
  }
  next();
}

module.exports = { authenticate, requireParent, createSession, deleteSession, cleanupSessions };
