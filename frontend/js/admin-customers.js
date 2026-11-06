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
  fillTable(body, customers.map((customer) => {
    const active = Number(customer.is_active) === 1;
    const actions = el('div', 'admin-customer-actions');
    actions.append(
      dataButton('Details', 'btn-secondary', { customerDetails: customer.id }),
      dataButton(active ? 'Block' : 'Unblock', active ? 'btn-danger' : 'btn-primary', { customerToggle: customer.id, nextActive: active ? 'false' : 'true' })
    );
    const tr = el('tr');
    tr.append(
      cellWithSub(customer.full_name, `#${customer.id}`),
      cellWithSub(customer.email, customer.phone || 'No phone provided'),
      cell(customer.booking_count),
      cell(customer.created_at),
      cell(statusPill(active ? 'ACTIVE' : 'BLOCKED')),
      cell(actions)
    );
    return tr;
  }), 6, 'No customers found.');
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
    fillDetailPanel(panel, 'Customer details', [
      ['Name', customer.full_name],
      ['Email', customer.email],
      ['Phone', customer.phone || 'Not provided'],
      ['Bookings', customer.booking_count],
      ['Joined', customer.created_at],
      ['Status', Number(customer.is_active) === 1 ? 'Active' : 'Blocked'],
    ]);
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
