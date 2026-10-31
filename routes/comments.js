const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

/**
 * Format comment object
 */
function formatComment(row, currentUserId) {
  return {
    id: row.id,
    post_id: row.post_id,
    content: row.content,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name
    },
    is_own_comment: Boolean(currentUserId && row.user_id === currentUserId)
  };
}

/**
 * GET /api/posts/:id/comments
 * Fetch all comments for a post in chronological order
 */
router.get('/posts/:id/comments', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const currentUserId = req.user ? req.user.id : 0;
    const rows = db.prepare(`
      SELECT 
        c.id,
        c.post_id,
        c.content,
        c.created_at,
        c.user_id,
        u.username,
        u.display_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);

    const comments = rows.map(row => formatComment(row, currentUserId));

    return res.json({ comments });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post
 */
router.post('/posts/:id/comments', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    let { content } = req.body;
    content = (content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    if (content.length > 280) {
      return res.status(400).json({ error: 'Comment cannot exceed 280 characters.' });
    }

    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, content) 
      VALUES (?, ?, ?)
    `).run(postId, req.user.id, content);

    const newCommentId = result.lastInsertRowid;

    const row = db.prepare(`
      SELECT 
        c.id,
        c.post_id,
        c.content,
        c.created_at,
        c.user_id,
        u.username,
        u.display_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(newCommentId);

    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(postId).count;

    return res.status(201).json({
      message: 'Comment added successfully!',
      comment: formatComment(row, req.user.id),
      comment_count: commentCount
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete a comment (only author can delete)
 */
router.delete('/comments/:id', requireAuth, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID.' });
    }

    const comment = db.prepare('SELECT id, post_id, user_id FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are only allowed to delete your own comments.' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    const remainingCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(comment.post_id).count;

    return res.json({
      success: true,
      message: 'Comment deleted successfully.',
      post_id: comment.post_id,
      comment_count: remainingCount
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

module.exports = router;
