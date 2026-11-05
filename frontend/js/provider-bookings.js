let providerBookings = [];

function showProviderBookingAlert(message, type = 'error') {
  const box = document.getElementById('provider-bookings-alert');
  box.textContent = message;
  box.className = `auth-alert auth-alert-${type} show`;
}

function makeBookingText(label, value) {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = `${label}: ${value === null || value === undefined || value === '' ? '—' : value}`;
  return p;
}

function renderProviderBookings() {
  const list = document.getElementById('provider-booking-list');
  const filter = document.getElementById('booking-status-filter').value;
  const rows = filter === 'ALL' ? providerBookings : providerBookings.filter((b) => b.booking_status === filter);
  list.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = filter === 'ALL' ? 'No bookings have been received for your packages yet.' : `No ${filter.toLowerCase()} bookings found.`;
    list.appendChild(empty);
    return;
  }

  rows.forEach((booking) => {
    const card = document.createElement('article');
    card.className = 'provider-package-card';
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${booking.package_title} · Booking #${booking.id}`;
    const status = document.createElement('span');
    status.className = `package-status package-status-${booking.booking_status.toLowerCase()}`;
    status.textContent = booking.booking_status;
    details.append(title, status,
      makeBookingText('Customer', booking.customer_name),
      makeBookingText('Email', booking.customer_email),
      makeBookingText('Phone', booking.customer_phone),
      makeBookingText('Departure', booking.departure_date),
      makeBookingText('Guests', booking.num_guests),
      makeBookingText('Booked on', booking.booked_at),
      makeBookingText('Total', `₹${Number(booking.total_price).toLocaleString('en-IN')}`),
      makeBookingText('Payment', booking.payment_status ? `${booking.payment_status}${booking.payment_method ? ` · ${booking.payment_method}` : ''}` : 'Not paid'),
      makeBookingText('Review rating', booking.review_rating ? `${booking.review_rating}/5` : 'Not reviewed')
    );

    const actions = document.createElement('div');
    actions.className = 'provider-package-actions';
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'btn btn-secondary';
    view.textContent = 'Refresh details';
    view.addEventListener('click', async () => {
      try {
        const fresh = await apiFetch(`/provider/bookings/${booking.id}`);
        showProviderBookingAlert(`Booking #${fresh.id} · ${fresh.package_title} · ${fresh.booking_status}`, 'success');
      } catch (err) { showProviderBookingAlert(err.message); }
    });
    actions.appendChild(view);

    if (booking.booking_status === 'PENDING') {
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'btn btn-primary';
      confirm.textContent = 'Confirm booking';
      confirm.disabled = booking.payment_status !== 'PAID';
      confirm.title = confirm.disabled ? 'Payment must be marked PAID before confirmation.' : '';
      confirm.addEventListener('click', async () => {
        if (!window.confirm(`Confirm booking #${booking.id}?`)) return;
        confirm.disabled = true;
        try {
          await apiFetch(`/provider/bookings/${booking.id}/confirm`, { method: 'POST', body: {} });
          showProviderBookingAlert(`Booking #${booking.id} confirmed.`, 'success');
          await loadProviderBookings();
        } catch (err) {
          showProviderBookingAlert(err.message);
          confirm.disabled = false;
        }
      });
      actions.appendChild(confirm);
    }
    card.append(details, actions);
    list.appendChild(card);
  });
}

async function loadProviderBookings() {
  providerBookings = await apiFetch('/provider/bookings');
  renderProviderBookings();
}

async function initProviderBookings() {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-bookings.html');
    return;
  }
  try {
    const user = await fetchCurrentUser();
    if (!user) return;
    if (user.role !== 'PROVIDER') {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }
    if (user.provider_status !== 'APPROVED') {
      showProviderBookingAlert(`Provider approval required. Current status: ${user.provider_status}.`);
      return;
    }
    await loadProviderBookings();
  } catch (err) { showProviderBookingAlert(err.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('booking-status-filter').addEventListener('change', renderProviderBookings);
  initProviderBookings();
});
