/**
 * Circle - Auth Page Logic (Login & Registration)
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to home feed
  const currentUser = getCurrentUser();
  const token = getToken();
  if (currentUser && token) {
    window.location.href = '/index.html';
    return;
  }

  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authHeading = document.getElementById('auth-heading');
  const authSubheading = document.getElementById('auth-subheading');

  function switchTab(mode) {
    if (mode === 'signup') {
      tabLogin.classList.remove('active');
      tabSignup.classList.add('active');
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      authHeading.textContent = 'Create your account';
      authSubheading.textContent = 'Join Circle and start sharing your thoughts.';
      document.getElementById('register-username').focus();
    } else {
      tabSignup.classList.remove('active');
      tabLogin.classList.add('active');
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
      authHeading.textContent = 'Welcome back to Circle';
      authSubheading.textContent = 'A friendly place for simple moments.';
      document.getElementById('login-username').focus();
    }
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabSignup.addEventListener('click', () => switchTab('signup'));

  // Check query params (e.g. ?tab=signup)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'signup') {
    switchTab('signup');
  }

  // Handle Demo credentials quick-fill
  document.querySelectorAll('.demo-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      const username = badge.getAttribute('data-user');
      switchTab('login');
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').value = 'password123';
      showToast(`Filled credentials for @${username}`, 'info');
    });
  });

  // Handle Login submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('login-submit-btn');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showToast('Please fill in both fields.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      setToken(data.token);
      setCurrentUser(data.user);
      showToast(data.message || 'Logged in successfully!', 'success');

      setTimeout(() => {
        window.location.href = '/index.html';
      }, 400);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });

  // Handle Register submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('register-submit-btn');
    const displayName = document.getElementById('register-display-name').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;

    if (!username || !password) {
      showToast('Username and password are required.', 'error');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      showToast('Username must be 3-20 characters long.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          display_name: displayName
        })
      });

      setToken(data.token);
      setCurrentUser(data.user);
      showToast(data.message || 'Account created successfully!', 'success');

      setTimeout(() => {
        window.location.href = '/index.html';
      }, 400);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
});
