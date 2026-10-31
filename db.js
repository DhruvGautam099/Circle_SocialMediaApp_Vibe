const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path
const dbPath = path.join(__dirname, 'circle.db');
const db = new Database(dbPath);

// Enable foreign key constraints and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize database schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(following_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (follower_id != following_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  `);

  seedDataIfEmpty();
}

// Seed initial users, posts, comments, likes, and follows
function seedDataIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('Seeding initial demo data...');
  const salt = bcrypt.genSaltSync(10);
  const defaultHash = bcrypt.hashSync('password123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, bio)
    VALUES (?, ?, ?, ?)
  `);

  const aliceId = insertUser.run(
    'alice',
    defaultHash,
    'Alice Walker',
    'Coffee enthusiast, UI designer & photographer ☕🎨'
  ).lastInsertRowid;

  const bobId = insertUser.run(
    'bob',
    defaultHash,
    'Bob Vance',
    'Building open source tools. Always learning something new 🚀💻'
  ).lastInsertRowid;

  const charlieId = insertUser.run(
    'charlie',
    defaultHash,
    'Charlie Rose',
    'Music lover, weekend hiker, and aspiring chef 🌿🎵'
  ).lastInsertRowid;

  // Insert seed posts
  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, created_at)
    VALUES (?, ?, datetime('now', ?))
  `);

  const p1 = insertPost.run(
    aliceId,
    'Just joined Circle! Excited to share thoughts and connect with everyone here. ✨',
    '-3 hours'
  ).lastInsertRowid;

  const p2 = insertPost.run(
    bobId,
    'Welcome to Circle! A fast, lightweight social space without annoying algorithms or clutter. What are you building today?',
    '-2 hours'
  ).lastInsertRowid;

  const p3 = insertPost.run(
    charlieId,
    'Baking sourdough on a quiet afternoon. The smell of fresh warm bread filling the kitchen is unmatched 🍞',
    '-1 hour'
  ).lastInsertRowid;

  const p4 = insertPost.run(
    aliceId,
    'Minimalism in design is not about having less. It is about making room for what matters most. 🤍',
    '-15 minutes'
  ).lastInsertRowid;

  // Insert seed comments
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, user_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);

  insertComment.run(p1, bobId, 'Welcome aboard Alice! Glad to have you here 🎉', '-2 hours');
  insertComment.run(p2, charlieId, 'Working on some fun web recipes right now!', '-45 minutes');
  insertComment.run(p3, aliceId, 'Save a slice for me please! Looks delicious 🤤', '-30 minutes');

  // Insert seed likes
  const insertLike = db.prepare(`
    INSERT OR IGNORE INTO likes (user_id, post_id)
    VALUES (?, ?)
  `);

  insertLike.run(bobId, p1);
  insertLike.run(charlieId, p1);
  insertLike.run(aliceId, p2);
  insertLike.run(charlieId, p2);
  insertLike.run(aliceId, p3);
  insertLike.run(bobId, p4);

  // Insert seed follows
  const insertFollow = db.prepare(`
    INSERT OR IGNORE INTO follows (follower_id, following_id)
    VALUES (?, ?)
  `);

  insertFollow.run(aliceId, bobId);
  insertFollow.run(bobId, aliceId);
  insertFollow.run(bobId, charlieId);
  insertFollow.run(charlieId, aliceId);

  console.log('Seed data successfully created!');
}

initSchema();

module.exports = db;
