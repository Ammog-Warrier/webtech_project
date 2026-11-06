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

  const toggleBtn = document.getElementById('theme-toggle');
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

// Shown when the API answers 503 because a super admin switched maintenance mode on.
function showMaintenanceNotice(message) {
  if (document.getElementById('maintenance-notice')) return;
  const banner = document.createElement('div');
  banner.id = 'maintenance-notice';
  banner.className = 'maintenance-notice';
  banner.setAttribute('role', 'alert');
  banner.textContent = message || 'The site is under maintenance. Please try again later.';
  document.body.prepend(banner);
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

// Prevent unnecessary page reload/flash when clicking a link that leads to the current page
function highlightActiveNavLink() {
  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const targetPath = href.replace(/\/index\.html$/, '') || '/';
    if (targetPath === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function preventSamePageReload() {
  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const targetPath = href.replace(/\/index\.html$/, '') || '/';
    if (targetPath === currentPath) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  });
}

function showLogoutConfirmation() {
  const existing = document.getElementById('logout-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'logout-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'logout-modal-title');

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';

  const title = document.createElement('h3');
  title.id = 'logout-modal-title';
  title.className = 'modal-title';
  title.textContent = 'Confirm Logout';

  const body = document.createElement('p');
  body.className = 'modal-body';
  body.textContent = 'Are you sure you want to log out?';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-danger';
  confirmBtn.textContent = 'Logout';

  function closeModal() {
    backdrop.remove();
    document.removeEventListener('keydown', handleKey);
  }

  function handleKey(e) {
    if (e.key === 'Escape') closeModal();
  }

  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', handleKey);

  confirmBtn.addEventListener('click', () => {
    closeModal();
    if (typeof clearSession === 'function') {
      clearSession({ redirect: false });
      window.location.replace('/');
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  dialog.appendChild(title);
  dialog.appendChild(body);
  dialog.appendChild(actions);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  cancelBtn.focus();
}

function syncNavbarAuth() {
  const nav = document.querySelector('.site-header .nav');
  if (!nav) return;

  const existingAuthArea = nav.querySelector('#nav-auth-area');
  if (existingAuthArea) existingAuthArea.remove();

  // Find standard login/register links if present
  const loginLink = nav.querySelector('a[href="/login.html"]');
  const registerLink = nav.querySelector('a[href="/register.html"]');
  const themeToggle = nav.querySelector('#theme-toggle');

  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  const user = typeof getStoredUser === 'function' ? getStoredUser() : null;

  if (token && user) {
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';

    const authContainer = document.createElement('div');
    authContainer.id = 'nav-auth-area';
    authContainer.className = 'nav-auth-group';

    const userBadge = document.createElement('span');
    userBadge.className = 'user-badge';
    userBadge.textContent = user.full_name || user.email;
    if (user.role && user.role !== 'CUSTOMER') {
      const rolePill = document.createElement('span');
      rolePill.className = 'role-pill';
      rolePill.textContent = user.role.replace('_', ' ');
      userBadge.appendChild(rolePill);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn-logout';
    logoutBtn.textContent = 'Logout';
    logoutBtn.addEventListener('click', () => {
      showLogoutConfirmation();
    });

    authContainer.appendChild(userBadge);
    authContainer.appendChild(logoutBtn);

    if (user.role === 'PROVIDER') {
      const dashboardLink = document.createElement('a');
      dashboardLink.href = '/provider-dashboard.html';
      dashboardLink.textContent = 'Provider Dashboard';
      dashboardLink.className = 'nav-link-provider';
      authContainer.prepend(dashboardLink);
    }

    if (user.role === 'CUSTOMER') {
      const myBookingsLink = document.createElement('a');
      myBookingsLink.href = '/my-bookings.html';
      myBookingsLink.textContent = 'My Bookings';
      myBookingsLink.className = 'nav-link-customer';

      const profileLink = document.createElement('a');
      profileLink.href = '/profile.html';
      profileLink.textContent = 'Profile';
      profileLink.className = 'nav-link-customer';

      const wishlistLink = document.createElement('a');
      wishlistLink.href = '/wishlist.html';
      wishlistLink.textContent = 'Wishlist';
      wishlistLink.className = 'nav-link-customer';

      authContainer.prepend(profileLink);
      authContainer.prepend(wishlistLink);
      authContainer.prepend(myBookingsLink);
    }

    if (themeToggle) {
      nav.insertBefore(authContainer, themeToggle);
    } else {
      nav.appendChild(authContainer);
    }
  } else {
    if (loginLink) loginLink.style.display = '';
    if (registerLink) registerLink.style.display = '';
  }
}

// Run theme attribute immediately on script load so dark colors apply without flashing
(function() {
  const currentTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);
})();

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  syncNavbarAuth();
  highlightActiveNavLink();
  preventSamePageReload();
  showHealth();

  // If logged in, asynchronously refresh user data from server in background
  if (typeof fetchCurrentUser === 'function' && getToken()) {
    const freshUser = await fetchCurrentUser();
    if (freshUser) {
      syncNavbarAuth();
    }
  }
});

window.addEventListener('auth:change', () => {
  syncNavbarAuth();
});

