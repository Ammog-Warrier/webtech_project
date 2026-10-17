// Demonstrates Fetch API: show backend/database status in the footer.
async function showHealth() {
  const el = document.getElementById('health-status');
  if (!el) return;
  try {
    const h = await apiFetch('/health');
    el.textContent = `Server: ${h.status} · Database: ${h.database}`;
  } catch (err) {
    el.textContent = `Server unreachable: ${err.message}`;
  }
}
document.addEventListener('DOMContentLoaded', showHealth);
