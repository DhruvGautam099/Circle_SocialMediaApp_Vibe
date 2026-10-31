/**
 * Circle - Main Feed Controller
 * Handles posts stream, tabs, live composer, likes, and inline comments
 */

// SVG Icon constants
const HEART_ICON_OUTLINE = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const HEART_ICON_FILLED = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

const COMMENT_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;

const TRASH_ICON = `<svg class="icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;

let currentFeedTab = 'all'; // 'all' or 'following'

document.addEventListener('DOMContentLoaded', () => {
  setupComposer();
  setupFeedTabs();
  loadPosts(currentFeedTab);
});

/**
 * Configure the post composer UI and counter
 */
function setupComposer() {
  const currentUser = getCurrentUser();
  const composerCard = document.getElementById('composer-card');
  const guestPrompt = document.getElementById('guest-prompt');
  const avatarSlot = document.getElementById('composer-avatar-slot');
  const postInput = document.getElementById('post-content-input');
  const charCounter = document.getElementById('char-counter');
  const submitBtn = document.getElementById('submit-post-btn');

  if (!currentUser) {
    if (composerCard) composerCard.style.display = 'none';
    if (guestPrompt) guestPrompt.style.display = 'block';
    return;
  }

  // Display user's avatar
  if (avatarSlot) {
    avatarSlot.innerHTML = '';
    avatarSlot.appendChild(createAvatarElement(currentUser, 'md'));
  }

  // Live character counter
  postInput.addEventListener('input', () => {
    const len = postInput.value.trim().length;
    charCounter.textContent = `${postInput.value.length} / 280`;

    if (postInput.value.length > 240) {
      charCounter.classList.add('warning');
    } else {
      charCounter.classList.remove('warning');
    }

    if (postInput.value.length > 280) {
      charCounter.classList.add('danger');
      submitBtn.disabled = true;
    } else {
      charCounter.classList.remove('danger');
      submitBtn.disabled = len === 0;
    }
  });

  // Submit new post
  submitBtn.addEventListener('click', async () => {
    const content = postInput.value.trim();
    if (!content || content.length > 280) return;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';

      const res = await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({ content })
      });

      postInput.value = '';
      charCounter.textContent = '0 / 280';
      charCounter.classList.remove('warning', 'danger');
      submitBtn.textContent = 'Post';
      submitBtn.disabled = true;

      showToast('Post published to your circle!', 'success');

      // Prepend the new post card to the feed
      const stream = document.getElementById('posts-stream');
      const emptyState = document.getElementById('feed-empty-state');
      if (emptyState) emptyState.remove();

      const newCard = renderPostCard(res.post);
      stream.insertBefore(newCard, stream.firstChild);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post';
    }
  });
}

/**
 * Configure Feed tabs ('For You' vs 'Following')
 */
function setupFeedTabs() {
  const tabForYou = document.getElementById('tab-for-you');
  const tabFollowing = document.getElementById('tab-following');

  tabForYou.addEventListener('click', () => {
    if (currentFeedTab === 'all') return;
    currentFeedTab = 'all';
    tabForYou.classList.add('active');
    tabFollowing.classList.remove('active');
    loadPosts('all');
  });

  tabFollowing.addEventListener('click', () => {
    if (currentFeedTab === 'following') return;
    const currentUser = getCurrentUser();
    if (!currentUser) {
      showToast('Please log in to see posts from people you follow.', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 500);
      return;
    }
    currentFeedTab = 'following';
    tabFollowing.classList.add('active');
    tabForYou.classList.remove('active');
    loadPosts('following');
  });
}

/**
 * Fetch and render posts from API
 */
async function loadPosts(feedType) {
  const stream = document.getElementById('posts-stream');
  stream.innerHTML = `
    <div class="loading-state" id="posts-loading">
      <div class="spinner"></div>
      <span>Loading circle feed...</span>
    </div>
  `;

  try {
    const data = await apiRequest(`/posts?feed=${feedType}`);
    stream.innerHTML = '';

    if (!data.posts || data.posts.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.id = 'feed-empty-state';
      emptyBox.className = 'empty-state';
      if (feedType === 'following') {
        emptyBox.innerHTML = `
          <div class="empty-icon">👥</div>
          <h3 class="empty-title">Your following feed is quiet</h3>
          <p class="empty-desc">You aren't following anyone yet, or they haven't shared a post. Explore "For You" to discover friendly people!</p>
        `;
      } else {
        emptyBox.innerHTML = `
          <div class="empty-icon">👋</div>
          <h3 class="empty-title">No posts yet</h3>
          <p class="empty-desc">Be the very first one to say hello to the circle!</p>
        `;
      }
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
        <h3 class="empty-title">Unable to load feed</h3>
        <p class="empty-desc">${escapeText(err.message)}</p>
        <button class="btn btn-outline btn-sm" style="margin-top: 1rem;" onclick="loadPosts('${feedType}')">Try Again</button>
      </div>
    `;
  }
}

/**
 * Render a complete interactive post card
 * Adheres strictly to XSS safety by setting textContent for user strings.
 */
function renderPostCard(post) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.id = `post-${post.id}`;

  // 1. Post Header (Avatar, Name, @username, Relative Time, and optional Delete button)
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

  // If viewer is author, show delete button
  if (post.is_own_post) {
    const actionsMenu = document.createElement('div');
    actionsMenu.className = 'post-actions-menu';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'post-delete-btn';
    deleteBtn.title = 'Delete post';
    deleteBtn.innerHTML = TRASH_ICON;
    deleteBtn.addEventListener('click', () => handleDeletePost(post.id, card));

    actionsMenu.appendChild(deleteBtn);
    header.appendChild(actionsMenu);
  }

  card.appendChild(header);

  // 2. Post Content (safe textContent)
  const contentP = document.createElement('p');
  contentP.className = 'post-content';
  contentP.textContent = post.content;
  card.appendChild(contentP);

  // 3. Post Footer Bar (Likes and Comments action buttons)
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

  likeBtn.addEventListener('click', () => handleToggleLike(post.id, likeBtn, likeIconSlot, likeCountSpan));
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

  // 4. Inline Comments Drawer
  const commentsDrawer = document.createElement('div');
  commentsDrawer.className = 'comments-drawer';
  commentsDrawer.id = `comments-drawer-${post.id}`;

  let commentsLoaded = false;
  commentBtn.addEventListener('click', () => {
    const isOpen = commentsDrawer.classList.toggle('open');
    if (isOpen && !commentsLoaded) {
      loadComments(post.id, commentsDrawer, commentCountSpan);
      commentsLoaded = true;
    }
  });

  footerBar.appendChild(commentBtn);
  card.appendChild(footerBar);
  card.appendChild(commentsDrawer);

  return card;
}

/**
 * Handle like / unlike toggle
 */
async function handleToggleLike(postId, btn, iconSlot, countSpan) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    showToast('Please log in to like posts.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 400);
    return;
  }

  try {
    // Add heart-pop animation
    btn.classList.add('heart-pop');
    setTimeout(() => btn.classList.remove('heart-pop'), 400);

    const data = await apiRequest(`/posts/${postId}/like`, { method: 'POST' });

    if (data.liked) {
      btn.classList.add('active-like');
      iconSlot.innerHTML = HEART_ICON_FILLED;
    } else {
      btn.classList.remove('active-like');
      iconSlot.innerHTML = HEART_ICON_OUTLINE;
    }
    countSpan.textContent = data.like_count;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Handle post deletion
 */
async function handleDeletePost(postId, cardElement) {
  if (!confirm('Are you sure you want to delete this post?')) return;

  try {
    await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    showToast('Post removed.', 'info');

    // Smooth removal
    cardElement.style.transition = 'opacity 0.2s, transform 0.2s';
    cardElement.style.opacity = '0';
    cardElement.style.transform = 'scale(0.96)';
    setTimeout(() => {
      cardElement.remove();
      const stream = document.getElementById('posts-stream') || document.getElementById('user-posts-stream');
      if (stream && stream.children.length === 0) {
        loadPosts(currentFeedTab);
      }
    }, 200);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Load inline comments for a post
 */
async function loadComments(postId, container, countBadge) {
  container.innerHTML = `
    <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 0.5rem;">
      Loading comments...
    </div>
  `;

  try {
    const data = await apiRequest(`/posts/${postId}/comments`);
    container.innerHTML = '';

    const currentUser = getCurrentUser();

    // 1. Comment Composer
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
        list.appendChild(renderCommentItem(res.comment, postId, countBadge));
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

    // 2. Comments List
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
        list.appendChild(renderCommentItem(comment, postId, countBadge));
      });
    }

    container.appendChild(list);
  } catch (err) {
    container.innerHTML = `<div style="font-size: 0.85rem; color: var(--danger);">${escapeText(err.message)}</div>`;
  }
}

/**
 * Render individual comment element
 */
function renderCommentItem(comment, postId, countBadge) {
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

  // If user is comment owner, allow deletion
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
