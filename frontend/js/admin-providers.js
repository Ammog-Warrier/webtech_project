function setProviderMessage(message, isError = false) {
  const status = document.getElementById('provider-status-message');
  status.textContent = message;
  status.classList.toggle('admin-dashboard-status-error', isError);
}

function showProviderError(message) {
  const error = document.getElementById('provider-error');
  error.textContent = message;
  error.className = 'auth-alert auth-alert-error show';
}

function renderProviders(providers) {
  const body = document.getElementById('provider-table-body');
  fillTable(body, providers.map((provider) => {
    const active = Number(provider.is_active) === 1;
    const status = provider.provider_status;
    const actions = el('div', 'admin-customer-actions');
    actions.append(dataButton('Details', 'btn-secondary', { providerDetails: provider.id }));
    if (active && status !== 'APPROVED') {
      actions.append(dataButton('Approve', 'btn-primary', { providerStatus: provider.id, nextStatus: 'APPROVED' }));
    }
    if (active && status === 'PENDING') {
      actions.append(dataButton('Reject', 'btn-danger', { providerStatus: provider.id, nextStatus: 'REJECTED' }));
    }
    actions.append(active
      ? dataButton('Block', 'btn-danger', { providerActive: provider.id, nextActive: 'false' })
      : dataButton('Unblock', 'btn-primary', { providerActive: provider.id, nextActive: 'true' }));
    const tr = el('tr');
    tr.append(
      cellWithSub(provider.full_name, `#${provider.id}`),
      cellWithSub(provider.email, provider.phone || 'No phone provided'),
      cell(provider.package_count),
      cell(provider.booking_count),
      cell(provider.created_at),
      cell(statusPill(active ? status : 'BLOCKED')),
      cell(actions)
    );
    return tr;
  }), 7, 'No providers found.');
}

async function loadProviders() {
  const refresh = document.getElementById('refresh-providers');
  const error = document.getElementById('provider-error');
  error.textContent = '';
  error.className = 'auth-alert';
  refresh.disabled = true;
  setProviderMessage('Loading providers…');
  try {
    const search = document.getElementById('provider-search').value.trim();
    const status = document.getElementById('provider-status-filter').value;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'ALL') params.set('status', status);
    const providers = await apiFetch(`/admin/providers${params.toString() ? `?${params}` : ''}`);
    renderProviders(providers);
    setProviderMessage(`${providers.length} provider account(s) found.`);
  } catch (err) {
    setProviderMessage('Unable to load provider accounts.', true);
    showProviderError(err.message || 'Unable to load providers.');
  } finally {
    refresh.disabled = false;
  }
}

async function showProviderDetails(providerId) {
  const panel = document.getElementById('provider-details');
  try {
    const provider = await apiFetch(`/admin/providers/${providerId}`);
    panel.hidden = false;
    fillDetailPanel(panel, 'Provider details', [
      ['Name', provider.full_name],
      ['Email', provider.email],
      ['Phone', provider.phone || 'Not provided'],
      ['Provider approval', provider.provider_status],
      ['Account access', Number(provider.is_active) === 1 ? 'Active' : 'Blocked'],
      ['Packages', provider.package_count],
      ['Bookings', provider.booking_count],
      ['Joined', provider.created_at],
    ]);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showProviderError(err.message || 'Unable to load provider details.');
  }
}

async function changeProviderStatus(providerId, nextStatus) {
  const action = nextStatus.toLowerCase();
  if (!window.confirm(`Are you sure you want to ${action} this provider?`)) return;
  try {
    await apiFetch(`/admin/providers/${providerId}/status`, {
      method: 'PATCH',
      body: { provider_status: nextStatus },
    });
    setProviderMessage(`Provider ${action}d successfully.`);
    document.getElementById('provider-details').hidden = true;
    await loadProviders();
  } catch (err) {
    showProviderError(err.message || `Unable to ${action} provider.`);
  }
}

async function changeProviderAccess(providerId, nextActive) {
  const action = nextActive ? 'unblock' : 'block';
  if (!window.confirm(`Are you sure you want to ${action} this provider account?`)) return;
  try {
    await apiFetch(`/admin/providers/${providerId}/status`, {
      method: 'PATCH',
      body: { is_active: nextActive },
    });
    setProviderMessage(`Provider account ${action}ed successfully.`);
    document.getElementById('provider-details').hidden = true;
    await loadProviders();
  } catch (err) {
    showProviderError(err.message || `Unable to ${action} provider.`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fadmin-providers.html');
    return;
  }
  const user = await fetchCurrentUser();
  if (!user) {
    window.location.replace('/login.html?redirect=%2Fadmin-providers.html');
    return;
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    window.location.replace(getRoleDashboardUrl(user.role));
    return;
  }

  document.getElementById('refresh-providers').addEventListener('click', loadProviders);
  document.getElementById('provider-status-filter').addEventListener('change', loadProviders);
  document.getElementById('provider-search').addEventListener('input', () => {
    window.clearTimeout(window.providerSearchTimer);
    window.providerSearchTimer = window.setTimeout(loadProviders, 300);
  });
  document.getElementById('provider-table-body').addEventListener('click', (event) => {
    const details = event.target.closest('[data-provider-details]');
    const approval = event.target.closest('[data-provider-status]');
    const access = event.target.closest('[data-provider-active]');
    if (details) showProviderDetails(details.dataset.providerDetails);
    if (approval) changeProviderStatus(approval.dataset.providerStatus, approval.dataset.nextStatus);
    if (access) changeProviderAccess(access.dataset.providerActive, access.dataset.nextActive === 'true');
  });
  await loadProviders();
});
