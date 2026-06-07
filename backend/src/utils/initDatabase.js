const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/kids_dashboard.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      pin_hash TEXT,
      role TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '🐱',
      color TEXT DEFAULT '#FFB6C1',
      parent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '⭐',
      category TEXT DEFAULT 'daily',
      is_default INTEGER DEFAULT 0,
      assigned_to TEXT NOT NULL,
      created_by TEXT NOT NULL,
      specific_date DATE,
      points INTEGER DEFAULT 10,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      date DATE NOT NULL,
      points_earned INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(task_id, user_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      total_points INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      total_tasks INTEGER DEFAULT 0,
      completion_rate REAL DEFAULT 0,
      cat_mood TEXT DEFAULT 'neutral',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(specific_date);
    CREATE INDEX IF NOT EXISTS idx_completions_user_date ON task_completions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_scores_user_date ON daily_scores(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  const parentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('parent').count;

  if (parentCount === 0) {
    const parentId = uuidv4();
    const defaultPin = process.env.DEFAULT_PARENT_PIN || '1234';
    const pinHash = bcrypt.hashSync(defaultPin, 10);

    db.prepare(`
      INSERT INTO users (id, username, pin_hash, role, name, avatar, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(parentId, 'parent', pinHash, 'parent', 'Parent', '👨‍👩‍👧', '#7C3AED');

    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('daily_reset_time', '00:00');
    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('week_start_day', '1');
    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('app_name', 'Kids Quest');

    console.log('====================================================');
    console.log('  Database initialized!');
    console.log(`  Default Parent PIN: ${defaultPin}`);
    console.log('  Change it from the Parent Settings page.');
    console.log('====================================================');
  }

  console.log('Database ready at:', dbPath);
}

function getDb() {
  return db;
}

if (require.main === module) {
  initializeDatabase();
  db.close();
}

module.exports = { initializeDatabase, getDb };
