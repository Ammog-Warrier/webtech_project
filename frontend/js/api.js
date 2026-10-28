// Shared fetch helper. Returns data on success, throws Error(message) on failure.
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();
  if (!json.success) {
    // If the server explicitly rejected the token as unauthenticated (401), clear the session
    if (res.status === 401 && typeof clearSession === 'function') {
      clearSession({ redirect: false });
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
