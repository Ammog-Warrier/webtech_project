// Shared fetch helper. Returns data on success, throws Error(message) on failure.
async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}
