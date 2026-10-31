const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

/**
 * Helper to build enriched post object
 */
function formatPost(row, currentUserId) {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name
    },
    like_count: row.like_count,
    comment_count: row.comment_count,
    liked_by_me: Boolean(row.liked_by_me),
    is_own_post: Boolean(currentUserId && row.user_id === currentUserId)
  };
}

/**
 * GET /api/posts
 * Fetch posts for 'for-you'/'all', 'following', or filtered by username
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const { feed, username } = req.query;
    const currentUserId = req.user ? req.user.id : 0;

    let baseQuery = `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        p.user_id,
        u.username,
        u.display_name,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) > 0 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
      FROM posts p
      JOIN users u ON p.user_id = u.id
    `;

    let params = [currentUserId];

    if (username) {
      // Filter by author's username
      baseQuery += ` WHERE u.username = ? COLLATE NOCASE ORDER BY p.created_at DESC`;
      params.push(username);
    } else if (feed === 'following') {
      if (!req.user) {
        return res.status(401).json({ error: 'Please log in to see posts from users you follow.' });
      }
      baseQuery += ` 
        WHERE p.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        )
        ORDER BY p.created_at DESC
      `;
      params.push(req.user.id);
    } else {
      // Global feed (For You / All)
      baseQuery += ` ORDER BY p.created_at DESC`;
    }

    const rows = db.prepare(baseQuery).all(...params);
    const posts = rows.map(row => formatPost(row, currentUserId));

    return res.json({ posts });
  } catch (error) {
    console.error('Fetch posts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve posts.' });
  }
});

/**
 * POST /api/posts
 * Create a new text post (max 280 characters)
 */
router.post('/', requireAuth, (req, res) => {
  try {
    let { content } = req.body;
    content = (content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    if (content.length > 280) {
      return res.status(400).json({ error: 'Post cannot exceed 280 characters.' });
    }

    const result = db.prepare(`
      INSERT INTO posts (user_id, content) 
      VALUES (?, ?)
    `).run(req.user.id, content);

    const newPostId = result.lastInsertRowid;

    const row = db.prepare(`
      SELECT 
        p.id,
        p.content,
        p.created_at,
        p.user_id,
        u.username,
        u.display_name,
        0 AS like_count,
        0 AS comment_count,
        0 AS liked_by_me
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(newPostId);

    return res.status(201).json({
      message: 'Post created successfully!',
      post: formatPost(row, req.user.id)
    });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ error: 'Failed to publish post.' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post (only author can delete)
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are only allowed to delete your own posts.' });
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

    return res.json({
      success: true,
      message: 'Post deleted successfully.'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ error: 'Failed to delete post.' });
  }
});

/**
 * POST /api/posts/:id/like
 * Toggle like/unlike for a post
 */
router.post('/:id/like', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);

    let liked = false;
    if (existing) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
      liked = false;
    } else {
      db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, postId);
      liked = true;
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);

    return res.json({
      liked,
      like_count: countRow.count
    });
  } catch (error) {
    console.error('Like toggle error:', error);
    return res.status(500).json({ error: 'Failed to update like status.' });
  }
});

module.exports = router;
