// Theme handling (dark mode / light mode) with localStorage and OS preference fallback
const THEME_STORAGE_KEY = 'lt_theme';

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    const isDark = theme === 'dark';
    toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    toggleBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    toggleBtn.innerHTML = isDark
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }
}

function initTheme() {
  const currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  // Auto-inject toggle button into .nav if not explicitly present
  let toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) {
    const nav = document.querySelector('.nav');
    if (nav) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'theme-toggle';
      toggleBtn.className = 'theme-toggle';
      nav.appendChild(toggleBtn);
      applyTheme(currentTheme);
    }
  }

  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = 'true';
    toggleBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = active === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(next);
    });
  }

  // Listen to OS-level preference change if user hasn't explicitly set a preference
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

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

// Run immediately for fast theme paint before full DOM render if head script exists
initTheme();
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  showHealth();
});

