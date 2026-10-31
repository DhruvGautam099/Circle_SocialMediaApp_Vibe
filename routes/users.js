const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

/**
 * GET /api/users/:username
 * Fetch user profile information, counts, and follow state
 */
router.get('/:username', optionalAuth, (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = db.prepare(`
      SELECT id, username, display_name, bio, created_at 
      FROM users 
      WHERE username = ? COLLATE NOCASE
    `).get(username);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(targetUser.id).count;
    const followersCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUser.id).count;
    const followingCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(targetUser.id).count;

    let isFollowing = false;
    let isMe = false;

    if (req.user) {
      isMe = req.user.id === targetUser.id;
      if (!isMe) {
        const followRecord = db.prepare(`
          SELECT 1 FROM follows 
          WHERE follower_id = ? AND following_id = ?
        `).get(req.user.id, targetUser.id);
        isFollowing = !!followRecord;
      }
    }

    return res.json({
      id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
      bio: targetUser.bio || '',
      created_at: targetUser.created_at,
      posts_count: postsCount,
      followers_count: followersCount,
      following_count: followingCount,
      is_following: isFollowing,
      is_me: isMe
    });
  } catch (error) {
    console.error('Fetch user error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

/**
 * PUT /api/users/me
 * Update display name and bio for currently logged-in user
 */
router.put('/me', requireAuth, (req, res) => {
  try {
    let { display_name, bio } = req.body;
    display_name = (display_name || '').trim();
    bio = (bio || '').trim();

    if (!display_name) {
      return res.status(400).json({ error: 'Display name cannot be empty.' });
    }

    if (display_name.length > 50) {
      return res.status(400).json({ error: 'Display name cannot exceed 50 characters.' });
    }

    if (bio.length > 160) {
      return res.status(400).json({ error: 'Bio cannot exceed 160 characters.' });
    }

    db.prepare(`
      UPDATE users 
      SET display_name = ?, bio = ? 
      WHERE id = ?
    `).run(display_name, bio, req.user.id);

    const updatedUser = db.prepare(`
      SELECT id, username, display_name, bio, created_at 
      FROM users 
      WHERE id = ?
    `).get(req.user.id);

    return res.json({
      message: 'Profile updated successfully!',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * POST /api/users/:username/follow
 * Toggle follow/unfollow for target user
 */
router.post('/:username/follow', requireAuth, (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);

    if (!targetUser) {
      return res.status(404).json({ error: 'User to follow not found.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const existingFollow = db.prepare(`
      SELECT 1 FROM follows 
      WHERE follower_id = ? AND following_id = ?
    `).get(req.user.id, targetUser.id);

    let following = false;
    if (existingFollow) {
      db.prepare(`
        DELETE FROM follows 
        WHERE follower_id = ? AND following_id = ?
      `).run(req.user.id, targetUser.id);
      following = false;
    } else {
      db.prepare(`
        INSERT INTO follows (follower_id, following_id) 
        VALUES (?, ?)
      `).run(req.user.id, targetUser.id);
      following = true;
    }

    const followersCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUser.id).count;

    return res.json({
      message: following ? 'Followed successfully' : 'Unfollowed successfully',
      following,
      followers_count: followersCount
    });
  } catch (error) {
    console.error('Follow toggle error:', error);
    return res.status(500).json({ error: 'Failed to update follow status.' });
  }
});

module.exports = router;
