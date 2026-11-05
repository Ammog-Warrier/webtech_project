function customerEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function setCustomerStatus(message, isError = false) {
  const status = document.getElementById('customer-status');
  status.textContent = message;
  status.classList.toggle('admin-dashboard-status-error', isError);
}

function showCustomerError(message) {
  const error = document.getElementById('customer-error');
  error.textContent = message;
  error.className = 'auth-alert auth-alert-error show';
}

function renderCustomers(customers) {
  const body = document.getElementById('customer-table-body');
  if (!customers.length) {
    body.innerHTML = '<tr><td colspan="6">No customers found.</td></tr>';
    return;
  }

  body.innerHTML = customers.map((customer) => {
    const active = Number(customer.is_active) === 1;
    return `<tr>
      <td><strong>${customerEscape(customer.full_name)}</strong><small>#${customer.id}</small></td>
      <td>${customerEscape(customer.email)}<small>${customerEscape(customer.phone || 'No phone provided')}</small></td>
      <td>${customer.booking_count}</td>
      <td>${customerEscape(customer.created_at)}</td>
      <td><span class="admin-account-status ${active ? 'is-active' : 'is-blocked'}">${active ? 'Active' : 'Blocked'}</span></td>
      <td><div class="admin-customer-actions">
        <button type="button" class="btn btn-secondary btn-small" data-customer-details="${customer.id}">Details</button>
        <button type="button" class="btn ${active ? 'btn-danger' : 'btn-primary'} btn-small" data-customer-toggle="${customer.id}" data-next-active="${active ? 'false' : 'true'}">${active ? 'Block' : 'Unblock'}</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function loadCustomers() {
  const refresh = document.getElementById('refresh-customers');
  const error = document.getElementById('customer-error');
  error.textContent = '';
  error.className = 'auth-alert';
  refresh.disabled = true;
  setCustomerStatus('Loading customers…');
  try {
    const search = document.getElementById('customer-search').value.trim();
    const status = document.getElementById('customer-status-filter').value;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'ALL') params.set('status', status);
    const customers = await apiFetch(`/admin/customers${params.toString() ? `?${params}` : ''}`);
    renderCustomers(customers);
    setCustomerStatus(`${customers.length} customer account(s) found.`);
  } catch (err) {
    setCustomerStatus('Unable to load customer accounts.', true);
    showCustomerError(err.message || 'Unable to load customers.');
  } finally {
    refresh.disabled = false;
  }
}

async function showCustomerDetails(customerId) {
  const panel = document.getElementById('customer-details');
  try {
    const customer = await apiFetch(`/admin/customers/${customerId}`);
    panel.hidden = false;
    panel.innerHTML = `<h2>Customer details</h2>
      <p><strong>Name:</strong> ${customerEscape(customer.full_name)}</p>
      <p><strong>Email:</strong> ${customerEscape(customer.email)}</p>
      <p><strong>Phone:</strong> ${customerEscape(customer.phone || 'Not provided')}</p>
      <p><strong>Bookings:</strong> ${customer.booking_count}</p>
      <p><strong>Joined:</strong> ${customerEscape(customer.created_at)}</p>
      <p><strong>Status:</strong> ${Number(customer.is_active) === 1 ? 'Active' : 'Blocked'}</p>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showCustomerError(err.message || 'Unable to load customer details.');
  }
}

async function toggleCustomerStatus(customerId, nextActive) {
  const action = nextActive ? 'unblock' : 'block';
  if (!window.confirm(`Are you sure you want to ${action} this customer?`)) return;
  try {
    await apiFetch(`/admin/customers/${customerId}/status`, {
      method: 'PATCH',
      body: { is_active: nextActive },
    });
    setCustomerStatus(`Customer account ${action}ed successfully.`);
    document.getElementById('customer-details').hidden = true;
    await loadCustomers();
  } catch (err) {
    showCustomerError(err.message || `Unable to ${action} customer.`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fadmin-customers.html');
    return;
  }
  const user = await fetchCurrentUser();
  if (!user) {
    window.location.replace('/login.html?redirect=%2Fadmin-customers.html');
    return;
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    window.location.replace(getRoleDashboardUrl(user.role));
    return;
  }

  document.getElementById('refresh-customers').addEventListener('click', loadCustomers);
  document.getElementById('customer-status-filter').addEventListener('change', loadCustomers);
  document.getElementById('customer-search').addEventListener('input', () => {
    window.clearTimeout(window.customerSearchTimer);
    window.customerSearchTimer = window.setTimeout(loadCustomers, 300);
  });
  document.getElementById('customer-table-body').addEventListener('click', (event) => {
    const detailsButton = event.target.closest('[data-customer-details]');
    const toggleButton = event.target.closest('[data-customer-toggle]');
    if (detailsButton) showCustomerDetails(detailsButton.dataset.customerDetails);
    if (toggleButton) toggleCustomerStatus(
      toggleButton.dataset.customerToggle,
      toggleButton.dataset.nextActive === 'true'
    );
  });
  await loadCustomers();
});
