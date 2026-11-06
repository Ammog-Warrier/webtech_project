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

function showPageNotice(message) {
  const main = document.querySelector('main');
  if (!main) return;
  const box = document.createElement('div');
  box.className = 'container section';
  const note = document.createElement('p');
  note.className = 'auth-alert auth-alert-error show';
  note.textContent = message;
  box.append(note);
  main.replaceChildren(box);
}

// Route guard for role-restricted pages. Verifies the session with the server, then checks the role
// (and, for ADMIN accounts, the permission). Returns the user, or null after redirecting or showing a
// notice. The backend enforces the same rules; this only keeps people out of pages they cannot use.
async function guardPage(roles, permission) {
  const here = encodeURIComponent(location.pathname + location.search);
  if (!getToken()) {
    window.location.replace(`/login.html?redirect=${here}`);
    return null;
  }
  let user;
  try {
    user = await apiFetch('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      clearSession({ redirect: false });
      window.location.replace(`/login.html?redirect=${here}`);
    } else {
      showPageNotice(err.message || 'The server is not reachable. Please try again.');
    }
    return null;
  }
  if (!roles.includes(user.role)) {
    window.location.replace(getRoleDashboardUrl(user.role));
    return null;
  }
  if (permission && user.role === 'ADMIN' && !(user.permissions || []).includes(permission)) {
    showPageNotice('You do not have permission to use this page. Ask a super admin to grant access.');
    return null;
  }
  return user;
}
