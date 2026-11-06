function setAdminStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatAdminCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function showAdminDashboardStatus(message, isError = false) {
  const status = document.getElementById('admin-dashboard-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('admin-dashboard-status-error', isError);
}

function renderAdminDashboard(data) {
  const stats = {
    'stat-registrations-today': data.registrations_today,
    'stat-bookings-today': data.bookings_today,
    'stat-pending-providers': data.pending_providers,
    'stat-total-customers': data.total_customers,
    'stat-blocked-customers': data.blocked_customers,
    'stat-total-providers': data.total_providers,
    'stat-rejected-providers': data.rejected_providers,
    'stat-total-packages': data.total_packages,
    'stat-pending-packages': data.pending_packages,
    'stat-total-destinations': data.total_destinations,
    'stat-total-categories': data.total_categories,
    'stat-total-bookings': data.total_bookings,
    'stat-pending-bookings': data.pending_bookings,
    'stat-confirmed-bookings': data.confirmed_bookings,
    'stat-completed-bookings': data.completed_bookings,
    'stat-cancelled-bookings': data.cancelled_bookings,
  };

  Object.entries(stats).forEach(([id, value]) => setAdminStat(id, value));
  setAdminStat('stat-active-customers', `${data.active_customers} active`);
  setAdminStat('stat-approved-providers', `${data.approved_providers} approved and active`);
  setAdminStat('stat-blocked-providers', `${data.blocked_providers} blocked`);
  setAdminStat('stat-approved-packages', `${data.approved_packages} approved`);
  setAdminStat('stat-paid-revenue', formatAdminCurrency(data.paid_revenue));
  setAdminStat('stat-refunded-amount', formatAdminCurrency(data.refunded_amount));
  setAdminStat('stat-net-collected', formatAdminCurrency(data.net_collected));
  setAdminStat('admin-last-updated', `Updated ${new Date().toLocaleTimeString('en-IN')}`);
}

// Hides shortcuts the signed-in admin may not use (the backend enforces this as well).
function applyShortcutVisibility(user) {
  document.querySelectorAll('[data-permission]').forEach((card) => {
    card.hidden = user.role === 'ADMIN' && !(user.permissions || []).includes(card.dataset.permission);
  });
  document.querySelectorAll('[data-role]').forEach((card) => {
    card.hidden = card.dataset.role !== user.role;
  });
}

async function loadAdminDashboard() {
  const content = document.getElementById('admin-dashboard-content');
  const errorBox = document.getElementById('admin-dashboard-error');
  const refreshButton = document.getElementById('refresh-admin-dashboard');

  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fadmin-dashboard.html');
    return;
  }

  if (refreshButton) refreshButton.disabled = true;
  if (errorBox) {
    errorBox.textContent = '';
    errorBox.className = 'auth-alert';
  }
  showAdminDashboardStatus('Loading platform overview…');

  try {
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('/login.html?redirect=%2Fadmin-dashboard.html');
      return;
    }
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }

    applyShortcutVisibility(user);
    const dashboard = await apiFetch('/admin/dashboard');
    renderAdminDashboard(dashboard);
    content.hidden = false;
    showAdminDashboardStatus('Platform overview loaded successfully.');
    syncNavbarAuth();
  } catch (err) {
    showAdminDashboardStatus('Unable to load the platform overview.', true);
    if (errorBox) {
      errorBox.textContent = err.message || 'Unable to load the admin dashboard.';
      errorBox.className = 'auth-alert auth-alert-error show';
    }
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-admin-dashboard');
  if (refreshButton) refreshButton.addEventListener('click', loadAdminDashboard);
  loadAdminDashboard();
});
