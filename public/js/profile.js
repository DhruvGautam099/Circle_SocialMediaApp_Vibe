/**
 * Circle - User Profile Page Controller
 * Handles profile viewing, edit bio modal, follow/unfollow toggle, and user's posts
 */

// SVG Icon constants
const HEART_ICON_OUTLINE = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const HEART_ICON_FILLED = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
const COMMENT_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
const TRASH_ICON = `<svg class="icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;

let profileUser = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  let username = urlParams.get('username');

  const currentUser = getCurrentUser();

  if (!username) {
    if (currentUser) {
      username = currentUser.username;
    } else {
      window.location.href = '/login.html';
      return;
    }
  }

  loadProfile(username);
  setupEditModal();
});

/**
 * Load user profile and their posts
 */
async function loadProfile(username) {
  const loadingEl = document.getElementById('profile-loading');
  const contentEl = document.getElementById('profile-content');

  try {
    const user = await apiRequest(`/users/${encodeURIComponent(username)}`);
    profileUser = user;

    document.title = `${user.display_name} (@${user.username}) — Circle`;

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Avatar
    const avatarSlot = document.getElementById('profile-avatar-slot');
    avatarSlot.innerHTML = '';
    avatarSlot.appendChild(createAvatarElement(user, 'lg'));

    // Titles
    document.getElementById('profile-display-name').textContent = user.display_name;
    document.getElementById('profile-username').textContent = `@${user.username}`;

    // Bio
    const bioEl = document.getElementById('profile-bio');
    if (user.bio && user.bio.trim().length > 0) {
      bioEl.textContent = user.bio;
      bioEl.style.display = 'block';
    } else {
      bioEl.textContent = user.is_me ? 'No bio yet. Tap "Edit Profile" to tell your circle about yourself.' : 'No bio yet.';
      bioEl.style.color = 'var(--text-light)';
      bioEl.style.fontStyle = 'italic';
      bioEl.style.display = 'block';
    }

    // Join date
    let joinDateStr = 'Joined recently';
    if (user.created_at) {
      const d = new Date(user.created_at.endsWith('Z') || user.created_at.includes('+') ? user.created_at : user.created_at.replace(' ', 'T') + 'Z');
      if (!isNaN(d.getTime())) {
        joinDateStr = `Joined ${d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
      }
    }
    document.getElementById('profile-join-date').textContent = joinDateStr;

    // Stats
    document.getElementById('stat-posts').textContent = user.posts_count || 0;
    document.getElementById('stat-followers').textContent = user.followers_count || 0;
    document.getElementById('stat-following').textContent = user.following_count || 0;

    // Action button: Edit Profile vs Follow/Unfollow
    renderActionButton(user);

    // Load user's posts
    loadUserPosts(user.username);
  } catch (err) {
    loadingEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">User not found</h3>
        <p class="empty-desc">${escapeText(err.message)}</p>
        <a href="/" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Back to Feed</a>
      </div>
    `;
  }
}

/**
 * Render Follow button or Edit Profile button
 */
function renderActionButton(user) {
  const slot = document.getElementById('profile-action-slot');
  slot.innerHTML = '';

  if (user.is_me) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.id = 'edit-profile-btn';
    editBtn.textContent = 'Edit Profile';
    editBtn.addEventListener('click', openEditModal);
    slot.appendChild(editBtn);
  } else {
    const followBtn = document.createElement('button');
    followBtn.className = `btn btn-sm ${user.is_following ? 'btn-outline' : 'btn-primary'}`;
    followBtn.textContent = user.is_following ? 'Following' : 'Follow';

    followBtn.addEventListener('click', async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        showToast('Please log in to follow users.', 'info');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 400);
        return;
      }

      try {
        followBtn.disabled = true;
        const res = await apiRequest(`/users/${encodeURIComponent(user.username)}/follow`, {
          method: 'POST'
        });

        user.is_following = res.following;
        user.followers_count = res.followers_count;

        document.getElementById('stat-followers').textContent = res.followers_count;

        if (res.following) {
          followBtn.className = 'btn btn-outline btn-sm';
          followBtn.textContent = 'Following';
          showToast(`Following @${user.username}`, 'success');
        } else {
          followBtn.className = 'btn btn-primary btn-sm';
          followBtn.textContent = 'Follow';
          showToast(`Unfollowed @${user.username}`, 'info');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        followBtn.disabled = false;
      }
    });

    slot.appendChild(followBtn);
  }
}

/**
 * Configure Edit Profile Modal
 */
function setupEditModal() {
  const modal = document.getElementById('edit-profile-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const form = document.getElementById('edit-profile-form');
  const bioInput = document.getElementById('edit-bio');
  const bioCounter = document.getElementById('edit-bio-counter');

  function closeModal() {
    modal.classList.remove('open');
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  bioInput.addEventListener('input', () => {
    bioCounter.textContent = `${bioInput.value.length} / 160`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-profile-btn');
    const newName = document.getElementById('edit-display-name').value.trim();
    const newBio = bioInput.value.trim();

    if (!newName) {
      showToast('Display name cannot be empty.', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const res = await apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: newName,
          bio: newBio
        })
      });

      // Update current user in storage
      const curr = getCurrentUser();
      if (curr) {
        curr.display_name = res.user.display_name;
        curr.bio = res.user.bio;
        setCurrentUser(curr);
      }

      // Update UI elements
      profileUser.display_name = res.user.display_name;
      profileUser.bio = res.user.bio;

      document.getElementById('profile-display-name').textContent = res.user.display_name;
      const bioEl = document.getElementById('profile-bio');
      bioEl.textContent = res.user.bio || 'No bio yet.';
      bioEl.style.color = res.user.bio ? 'var(--text-main)' : 'var(--text-light)';
      bioEl.style.fontStyle = res.user.bio ? 'normal' : 'italic';

      // Refresh avatar initial
      const avatarSlot = document.getElementById('profile-avatar-slot');
      avatarSlot.innerHTML = '';
      avatarSlot.appendChild(createAvatarElement(profileUser, 'lg'));

      initNavbar();
      closeModal();
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

function openEditModal() {
  if (!profileUser) return;
  const modal = document.getElementById('edit-profile-modal');
  const nameInput = document.getElementById('edit-display-name');
  const bioInput = document.getElementById('edit-bio');
  const bioCounter = document.getElementById('edit-bio-counter');

  nameInput.value = profileUser.display_name || '';
  bioInput.value = profileUser.bio || '';
  bioCounter.textContent = `${bioInput.value.length} / 160`;

  modal.classList.add('open');
  nameInput.focus();
}

/**
 * Load and render user's posts
 */
async function loadUserPosts(username) {
  const stream = document.getElementById('user-posts-stream');
  stream.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading posts...</span>
    </div>
  `;

  try {
    const data = await apiRequest(`/posts?username=${encodeURIComponent(username)}`);
    stream.innerHTML = '';

    if (!data.posts || data.posts.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-state';
      emptyBox.innerHTML = `
        <div class="empty-icon">📝</div>
        <h3 class="empty-title">No posts yet</h3>
        <p class="empty-desc">${profileUser && profileUser.is_me ? "You haven't posted anything yet. Share your thoughts with the circle!" : "This user hasn't posted anything yet."}</p>
      `;
      stream.appendChild(emptyBox);
      return;
    }

    data.posts.forEach(post => {
      stream.appendChild(renderPostCard(post));
    });
  } catch (err) {
    stream.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3 class="empty-title">Failed to load posts</h3>
        <p class="empty-desc">${escapeText(err.message)}</p>
      </div>
    `;
  }
}

/**
 * Render Post Card (identical rich interactive capability as feed)
 */
function renderPostCard(post) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.id = `post-${post.id}`;

  const header = document.createElement('div');
  header.className = 'post-header';

  const authorRow = document.createElement('div');
  authorRow.className = 'post-author-row';

  const avatar = createAvatarElement(post.author, 'md');
  const metaBox = document.createElement('div');
  metaBox.className = 'post-author-meta';

  const nameLink = document.createElement('a');
  nameLink.className = 'author-name-link';
  nameLink.href = `/profile.html?username=${encodeURIComponent(post.author.username)}`;
  nameLink.textContent = post.author.display_name || post.author.username;

  const subMeta = document.createElement('div');
  subMeta.className = 'post-sub-meta';

  const usernameSpan = document.createElement('span');
  usernameSpan.textContent = `@${post.author.username}`;

  const dotSpan = document.createElement('span');
  dotSpan.className = 'post-dot';
  dotSpan.textContent = '•';

  const timeSpan = document.createElement('time');
  timeSpan.className = 'post-time';
  timeSpan.textContent = formatRelativeTime(post.created_at);

  subMeta.appendChild(usernameSpan);
  subMeta.appendChild(dotSpan);
  subMeta.appendChild(timeSpan);

  metaBox.appendChild(nameLink);
  metaBox.appendChild(subMeta);

  authorRow.appendChild(avatar);
  authorRow.appendChild(metaBox);
  header.appendChild(authorRow);

  if (post.is_own_post) {
    const actionsMenu = document.createElement('div');
    actionsMenu.className = 'post-actions-menu';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'post-delete-btn';
    deleteBtn.title = 'Delete post';
    deleteBtn.innerHTML = TRASH_ICON;
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this post?')) return;
      try {
        await apiRequest(`/posts/${post.id}`, { method: 'DELETE' });
        showToast('Post removed.', 'info');
        card.remove();
        // Update stats counter
        const postStat = document.getElementById('stat-posts');
        if (postStat) {
          const currentCount = parseInt(postStat.textContent, 10);
          if (!isNaN(currentCount) && currentCount > 0) {
            postStat.textContent = currentCount - 1;
          }
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    actionsMenu.appendChild(deleteBtn);
    header.appendChild(actionsMenu);
  }

  card.appendChild(header);

  const contentP = document.createElement('p');
  contentP.className = 'post-content';
  contentP.textContent = post.content;
  card.appendChild(contentP);

  const footerBar = document.createElement('div');
  footerBar.className = 'post-footer-bar';

  // Like Button
  const likeBtn = document.createElement('button');
  likeBtn.className = `action-btn ${post.liked_by_me ? 'active-like' : ''}`;
  likeBtn.title = post.liked_by_me ? 'Unlike' : 'Like';

  const likeIconSlot = document.createElement('span');
  likeIconSlot.innerHTML = post.liked_by_me ? HEART_ICON_FILLED : HEART_ICON_OUTLINE;

  const likeCountSpan = document.createElement('span');
  likeCountSpan.textContent = post.like_count > 0 ? post.like_count : '0';

  likeBtn.appendChild(likeIconSlot);
  likeBtn.appendChild(likeCountSpan);

  likeBtn.addEventListener('click', async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      showToast('Please log in to like posts.', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 400);
      return;
    }

    try {
      likeBtn.classList.add('heart-pop');
      setTimeout(() => likeBtn.classList.remove('heart-pop'), 400);

      const data = await apiRequest(`/posts/${post.id}/like`, { method: 'POST' });
      if (data.liked) {
        likeBtn.classList.add('active-like');
        likeIconSlot.innerHTML = HEART_ICON_FILLED;
      } else {
        likeBtn.classList.remove('active-like');
        likeIconSlot.innerHTML = HEART_ICON_OUTLINE;
      }
      likeCountSpan.textContent = data.like_count;
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  footerBar.appendChild(likeBtn);

  // Comment Button
  const commentBtn = document.createElement('button');
  commentBtn.className = 'action-btn';
  commentBtn.title = 'Comments';

  const commentIconSlot = document.createElement('span');
  commentIconSlot.innerHTML = COMMENT_ICON;

  const commentCountSpan = document.createElement('span');
  commentCountSpan.textContent = post.comment_count > 0 ? post.comment_count : '0';

  commentBtn.appendChild(commentIconSlot);
  commentBtn.appendChild(commentCountSpan);

  const commentsDrawer = document.createElement('div');
  commentsDrawer.className = 'comments-drawer';
  commentsDrawer.id = `comments-drawer-${post.id}`;

  let commentsLoaded = false;
  commentBtn.addEventListener('click', () => {
    const isOpen = commentsDrawer.classList.toggle('open');
    if (isOpen && !commentsLoaded) {
      loadProfilePostComments(post.id, commentsDrawer, commentCountSpan);
      commentsLoaded = true;
    }
  });

  footerBar.appendChild(commentBtn);
  card.appendChild(footerBar);
  card.appendChild(commentsDrawer);

  return card;
}

/**
 * Load comments for a post on the profile page
 */
async function loadProfilePostComments(postId, container, countBadge) {
  container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 0.5rem;">Loading comments...</div>`;

  try {
    const data = await apiRequest(`/posts/${postId}/comments`);
    container.innerHTML = '';

    const currentUser = getCurrentUser();

    const composerBox = document.createElement('div');
    composerBox.className = 'comment-composer';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'comment-input';
    input.placeholder = currentUser ? 'Write a friendly reply...' : 'Log in to leave a reply';
    input.disabled = !currentUser;
    input.maxLength = 280;

    const replyBtn = document.createElement('button');
    replyBtn.className = 'btn btn-primary btn-sm';
    replyBtn.textContent = 'Reply';
    replyBtn.disabled = !currentUser;

    async function submitReply() {
      const content = input.value.trim();
      if (!content) return;
      if (!currentUser) {
        window.location.href = '/login.html';
        return;
      }

      try {
        replyBtn.disabled = true;
        const res = await apiRequest(`/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });

        input.value = '';
        replyBtn.disabled = false;
        countBadge.textContent = res.comment_count;

        const emptyNotice = container.querySelector('.comments-empty-notice');
        if (emptyNotice) emptyNotice.remove();

        const list = container.querySelector('.comments-list');
        list.appendChild(renderProfileCommentItem(res.comment, postId, countBadge));
        showToast('Comment added!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
        replyBtn.disabled = false;
      }
    }

    replyBtn.addEventListener('click', submitReply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitReply();
    });

    composerBox.appendChild(input);
    composerBox.appendChild(replyBtn);
    container.appendChild(composerBox);

    const list = document.createElement('div');
    list.className = 'comments-list';

    if (!data.comments || data.comments.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'comments-empty-notice';
      emptyNotice.style.cssText = 'font-size: 0.85rem; color: var(--text-light); text-align: center; padding: 0.5rem;';
      emptyNotice.textContent = 'No comments yet. Say something nice! ✨';
      container.appendChild(emptyNotice);
    } else {
      data.comments.forEach(comment => {
        list.appendChild(renderProfileCommentItem(comment, postId, countBadge));
      });
    }

    container.appendChild(list);
  } catch (err) {
    container.innerHTML = `<div style="font-size: 0.85rem; color: var(--danger);">${escapeText(err.message)}</div>`;
  }
}

function renderProfileCommentItem(comment, postId, countBadge) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.id = `comment-${comment.id}`;

  const avatar = createAvatarElement(comment.author, 'sm');
  item.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'comment-body';

  const header = document.createElement('div');
  header.className = 'comment-header';

  const authorLink = document.createElement('a');
  authorLink.className = 'comment-author-name';
  authorLink.href = `/profile.html?username=${encodeURIComponent(comment.author.username)}`;
  authorLink.textContent = comment.author.display_name || comment.author.username;

  const meta = document.createElement('div');
  meta.className = 'comment-meta';

  const time = document.createElement('span');
  time.textContent = formatRelativeTime(comment.created_at);
  meta.appendChild(time);

  if (comment.is_own_comment) {
    const delBtn = document.createElement('button');
    delBtn.className = 'comment-delete-btn';
    delBtn.title = 'Delete comment';
    delBtn.innerHTML = TRASH_ICON;
    delBtn.addEventListener('click', async () => {
      try {
        const res = await apiRequest(`/comments/${comment.id}`, { method: 'DELETE' });
        item.remove();
        countBadge.textContent = res.comment_count;
        showToast('Comment deleted.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    meta.appendChild(delBtn);
  }

  header.appendChild(authorLink);
  header.appendChild(meta);

  const text = document.createElement('p');
  text.className = 'comment-text';
  text.textContent = comment.content;

  body.appendChild(header);
  body.appendChild(text);
  item.appendChild(body);

  return item;
}
