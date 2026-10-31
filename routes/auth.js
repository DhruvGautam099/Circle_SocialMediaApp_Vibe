const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', (req, res) => {
  try {
    let { username, password, display_name } = req.body;

    username = (username || '').trim();
    password = (password || '').trim();
    display_name = (display_name || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (!display_name) {
      display_name = username;
    } else if (display_name.length > 50) {
      return res.status(400).json({ error: 'Display name cannot exceed 50 characters.' });
    }

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, bio)
      VALUES (?, ?, ?, '')
    `).run(username, password_hash, display_name);

    const newUser = db.prepare('SELECT id, username, display_name, bio, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error while creating account.' });
  }
});

/**
 * POST /api/auth/login
 * Log in with username and password
 */
router.post('/login', (req, res) => {
  try {
    let { username, password } = req.body;
    username = (username || '').trim();
    password = (password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter both username and password.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userProfile = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      created_at: user.created_at
    };

    return res.json({
      message: 'Logged in successfully!',
      token,
      user: userProfile
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error while logging in.' });
  }
});

/**
 * GET /api/auth/me
 * Validate session and return current user profile
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
