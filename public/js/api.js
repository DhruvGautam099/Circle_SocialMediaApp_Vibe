/**
 * Circle - Shared API & Utility Helpers
 */

const API_BASE = '/api';

// Authentication & Local Storage Helpers
function getToken() {
  return localStorage.getItem('circle_token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('circle_token', token);
  } else {
    localStorage.removeItem('circle_token');
  }
}

function getCurrentUser() {
  const userStr = localStorage.getItem('circle_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('circle_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('circle_user');
  }
}

function logout() {
  setToken(null);
  setCurrentUser(null);
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 350);
}

/**
 * Fetch wrapper that attaches JWT token and parses JSON responses.
 * Throws an Error with the API's error message if the response is not OK.
 */
async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { message: await response.text() };
  }

  if (!response.ok) {
    // If unauthorized, clear invalid session
    if (response.status === 401 && token) {
      setToken(null);
      setCurrentUser(null);
    }
    const errorMsg = data && data.error ? data.error : `Request failed (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Toast Notification System
 */
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

function showToast(message, type = 'info') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  toast.innerHTML = iconSvg;
  toast.appendChild(textSpan);
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove after 3.2s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, 3200);
}

/**
 * Format relative time (e.g. 'just now', '5m ago', '2h ago', '3d ago')
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  // Ensure UTC date parsed cleanly if SQLite CURRENT_TIMESTAMP
  let date;
  if (dateString.endsWith('Z') || dateString.includes('+')) {
    date = new Date(dateString);
  } else {
    date = new Date(dateString.replace(' ', 'T') + 'Z');
  }

  if (isNaN(date.getTime())) {
    date = new Date(dateString);
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  // Fallback to short date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Consistent pastel color palettes for avatars based on username
 */
const AVATAR_PALETTES = [
  { bg: '#FFE9E4', text: '#D84334' }, // warm coral
  { bg: '#EDE9FE', text: '#6D28D9' }, // soft lavender
  { bg: '#E0F2FE', text: '#0369A1' }, // sky blue
  { bg: '#DCFCE7', text: '#15803D' }, // fresh mint
  { bg: '#FEF3C7', text: '#B45309' }, // warm amber
  { bg: '#FCE7F3', text: '#BE185D' }, // soft rose
  { bg: '#CCFBF1', text: '#0F766E' }, // teal
  { bg: '#F1F5F9', text: '#334155' }  // slate
];

function getAvatarPalette(username) {
  if (!username) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

/**
 * Generates an avatar circle element with the initial letter
 */
function createAvatarElement(user, size = 'md') {
  const avatar = document.createElement('div');
  avatar.className = `avatar avatar-${size}`;

  const displayName = (user && (user.display_name || user.username)) || '?';
  const username = (user && user.username) || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const palette = getAvatarPalette(username);
  avatar.style.backgroundColor = palette.bg;
  avatar.style.color = palette.text;
  avatar.textContent = initial;
  avatar.setAttribute('aria-label', `${displayName}'s avatar`);

  return avatar;
}

/**
 * Update top navbar based on auth state
 */
function initNavbar() {
  const navUserSection = document.getElementById('nav-user-section');
  if (!navUserSection) return;

  const currentUser = getCurrentUser();

  if (currentUser) {
    navUserSection.innerHTML = `
      <a href="/profile.html?username=${encodeURIComponent(currentUser.username)}" class="nav-profile-link" id="nav-profile-btn" title="View Profile">
        <div id="nav-avatar-slot"></div>
        <span class="nav-username">${escapeText(currentUser.display_name || currentUser.username)}</span>
      </a>
      <button id="logout-btn" class="btn btn-ghost btn-sm" title="Log Out">
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
        </svg>
        <span>Logout</span>
      </button>
    `;

    const avatarSlot = document.getElementById('nav-avatar-slot');
    if (avatarSlot) {
      avatarSlot.appendChild(createAvatarElement(currentUser, 'sm'));
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  } else {
    navUserSection.innerHTML = `
      <a href="/login.html" class="btn btn-outline btn-sm">Log In</a>
      <a href="/login.html?tab=signup" class="btn btn-primary btn-sm">Sign Up</a>
    `;
  }
}

/**
 * Simple text escaper for safe HTML string interpolation
 */
function escapeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Auto-run navbar check when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
});
