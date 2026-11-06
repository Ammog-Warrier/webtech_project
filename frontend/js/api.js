// Shared fetch helper. Returns data on success, throws Error(message) on failure.
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body,
  });

  const json = await res.json();
  if (!json.success) {
    // Maintenance mode: tell the visitor why requests fail (admins are not affected by it).
    if (res.status === 503 && typeof showMaintenanceNotice === 'function') {
      showMaintenanceNotice(json.error && json.error.message);
    }
    // If the server explicitly rejected the token as unauthenticated (401), clear the session
    if (res.status === 401 && typeof clearSession === 'function') {
      clearSession({ redirect: false });
      // An expired or invalid token on a normal page: go back to login and return here afterwards.
      if (token && !/^\/(login|register)\.html$/.test(location.pathname)) {
        window.location.replace(`/login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      }
    }
    // If the account was disabled (403), also clear the session
    if (res.status === 403 && json.error && json.error.message && json.error.message.includes('disabled') && typeof clearSession === 'function') {
      clearSession({ redirect: false });
    }
    const err = new Error(json.error ? json.error.message : 'Request failed');
    err.status = res.status;
    throw err;
  }
  return json.data;
}
