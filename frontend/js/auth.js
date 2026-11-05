// Authentication state and helpers
const TOKEN_KEY = 'lt_token';
const USER_KEY = 'lt_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth:change', { detail: { token, user } }));
}

function clearSession(options = { redirect: true }) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('auth:change', { detail: { token: null, user: null } }));
  if (options.redirect) {
    window.location.href = '/login.html';
  }
}

async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const user = await apiFetch('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    // Stale or invalid token was automatically cleared by apiFetch on 401
    return null;
  }
}

function getRoleDashboardUrl(role) {
  switch (role) {
    case 'CUSTOMER':
      return '/my-bookings.html';
    case 'PROVIDER':
      return '/provider-dashboard.html';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin-dashboard.html';
    default:
      return '/packages.html';
  }
}
