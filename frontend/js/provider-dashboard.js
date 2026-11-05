function setProviderStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function showProviderStatus(status, message) {
  const panel = document.getElementById('provider-status');
  if (!panel) return;
  panel.className = `provider-status-panel provider-status-${status.toLowerCase()}`;
  const heading = document.createElement('strong');
  heading.textContent = status.replace('_', ' ');
  const description = document.createElement('p');
  description.textContent = message;
  panel.replaceChildren(heading, description);
}

function formatProviderCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

async function loadProviderDashboard() {
  const errorBox = document.getElementById('provider-dashboard-error');
  const content = document.getElementById('provider-dashboard-content');

  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-dashboard.html');
    return;
  }

  try {
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('/login.html?redirect=%2Fprovider-dashboard.html');
      return;
    }
    if (user.role !== 'PROVIDER') {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }

    const dashboard = await apiFetch('/provider/dashboard');
    const statusMessages = {
      PENDING: 'Your provider account is waiting for admin approval. You can view this dashboard, but package management will be available after approval.',
      REJECTED: 'Your provider application was rejected. Please contact the administrator for more information.',
      APPROVED: 'Your provider account is approved. Provider management tools will be available here.',
    };
    showProviderStatus(dashboard.provider_status, statusMessages[dashboard.provider_status] || 'Your provider account status is unavailable.');

    setProviderStat('stat-total-packages', dashboard.total_packages);
    setProviderStat('stat-pending-packages', dashboard.pending_packages);
    setProviderStat('stat-approved-packages', dashboard.approved_packages);
    setProviderStat('stat-rejected-packages', dashboard.rejected_packages);
    setProviderStat('stat-total-bookings', dashboard.total_bookings);
    setProviderStat('stat-pending-bookings', dashboard.pending_bookings);
    setProviderStat('stat-confirmed-bookings', dashboard.confirmed_bookings);
    setProviderStat('stat-completed-bookings', dashboard.completed_bookings);
    setProviderStat('stat-earnings', formatProviderCurrency(dashboard.total_earnings));
    setProviderStat('stat-rating', dashboard.average_rating === null ? 'No ratings yet' : `${dashboard.average_rating} / 5`);
    setProviderStat('stat-review-count', `${dashboard.review_count} review(s)`);
    setProviderStat('stat-upcoming-departures', dashboard.upcoming_departures);

    content.hidden = false;
    syncNavbarAuth();
  } catch (err) {
    errorBox.textContent = err.message || 'Unable to load your provider dashboard.';
    errorBox.className = 'auth-alert auth-alert-error show';
  }
}

document.addEventListener('DOMContentLoaded', loadProviderDashboard);
