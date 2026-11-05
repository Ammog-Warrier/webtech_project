function performanceCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function performanceNode(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value == null || value === '' ? '—' : String(value);
  return node;
}

function showPerformanceMessage(message, isError = false) {
  const box = document.getElementById('performance-message');
  box.textContent = message || '';
  box.className = message ? `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} show` : 'auth-alert';
}

function renderPackageRevenue(packages) {
  const container = document.getElementById('package-revenue-list');
  container.replaceChildren();
  if (!packages.length) {
    container.append(performanceNode('p', 'muted', 'No packages found yet.'));
    return;
  }
  packages.forEach((item) => {
    const card = performanceNode('article', 'provider-stat-card', '');
    card.append(performanceNode('strong', '', item.package_title));
    card.append(performanceNode('p', 'muted', `Paid: ${performanceCurrency(item.paid_total)} · Refunded: ${performanceCurrency(item.refunded_total)} · Net: ${performanceCurrency(item.net_total)}`));
    card.append(performanceNode('small', 'muted', `${item.booking_count} booking(s)`));
    container.append(card);
  });
}

function renderRecentPayments(payments) {
  const container = document.getElementById('recent-payment-list');
  container.replaceChildren();
  if (!payments.length) {
    container.append(performanceNode('p', 'muted', 'No payment records yet.'));
    return;
  }
  payments.forEach((item) => {
    const card = performanceNode('article', 'provider-stat-card', '');
    card.append(performanceNode('strong', '', `Booking #${item.booking_id} · ${item.package_title}`));
    card.append(performanceNode('p', 'muted', `Customer: ${item.customer_name} · ${item.method} · ${item.status}`));
    card.append(performanceNode('p', '', `${performanceCurrency(item.amount)} · ${item.paid_at}`));
    container.append(card);
  });
}

function renderProviderReviews(payload) {
  const stats = payload.stats;
  document.getElementById('reviews-average').textContent = stats.average_rating === null ? 'No ratings yet' : `${stats.average_rating} / 5`;
  document.getElementById('reviews-count').textContent = stats.review_count;
  const container = document.getElementById('provider-review-list');
  container.replaceChildren();
  if (!payload.reviews.length) {
    container.append(performanceNode('p', 'muted', 'No customer reviews yet.'));
    return;
  }
  payload.reviews.forEach((review) => {
    const card = performanceNode('article', 'provider-stat-card', '');
    card.append(performanceNode('strong', '', `${review.package_title} · ${review.rating}/5`));
    card.append(performanceNode('p', 'muted', `By ${review.customer_name} · Booking #${review.booking_id} · ${review.reviewed_at}`));
    card.append(performanceNode('p', '', review.comment || 'No written comment.'));
    container.append(card);
  });
}

async function loadProviderPerformance() {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-performance.html');
    return;
  }
  try {
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('/login.html?redirect=%2Fprovider-performance.html');
      return;
    }
    if (user.role !== 'PROVIDER') {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }
    const [finance, reviews] = await Promise.all([
      apiFetch('/provider/finance'),
      apiFetch('/provider/reviews'),
    ]);
    document.getElementById('finance-paid').textContent = performanceCurrency(finance.summary.paid_total);
    document.getElementById('finance-refunded').textContent = performanceCurrency(finance.summary.refunded_total);
    document.getElementById('finance-net').textContent = performanceCurrency(finance.summary.net_total);
    document.getElementById('finance-unpaid').textContent = finance.summary.unpaid_bookings;
    document.getElementById('finance-unpaid-value').textContent = `Booking value: ${performanceCurrency(finance.summary.unpaid_value)}`;
    renderPackageRevenue(finance.packages);
    renderRecentPayments(finance.recent_payments);
    renderProviderReviews(reviews);
    showPerformanceMessage('Earnings and reviews loaded.');
    if (typeof syncNavbarAuth === 'function') syncNavbarAuth();
  } catch (err) {
    showPerformanceMessage(err.message || 'Unable to load provider earnings and reviews.', true);
  }
}

document.addEventListener('DOMContentLoaded', loadProviderPerformance);
