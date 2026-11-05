function providerEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

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

function providerStatusLabel(provider) {
  if (Number(provider.is_active) !== 1) return 'Blocked';
  return String(provider.provider_status || 'PENDING').charAt(0) +
    String(provider.provider_status || 'PENDING').slice(1).toLowerCase();
}

function renderProviders(providers) {
  const body = document.getElementById('provider-table-body');
  if (!providers.length) {
    body.innerHTML = '<tr><td colspan="7">No providers found.</td></tr>';
    return;
  }

  body.innerHTML = providers.map((provider) => {
    const active = Number(provider.is_active) === 1;
    const status = provider.provider_status;
    const label = providerStatusLabel(provider);
    const badgeClass = !active ? 'is-blocked' : (status === 'APPROVED' ? 'is-active' : 'is-pending');
    const approvalActions = active && status === 'PENDING'
      ? `<button type="button" class="btn btn-primary btn-small" data-provider-status="${provider.id}" data-next-status="APPROVED">Approve</button>
         <button type="button" class="btn btn-danger btn-small" data-provider-status="${provider.id}" data-next-status="REJECTED">Reject</button>`
      : (active && status === 'REJECTED'
        ? `<button type="button" class="btn btn-primary btn-small" data-provider-status="${provider.id}" data-next-status="APPROVED">Approve</button>`
        : '');
    const accessAction = active
      ? `<button type="button" class="btn btn-danger btn-small" data-provider-active="${provider.id}" data-next-active="false">Block</button>`
      : `<button type="button" class="btn btn-primary btn-small" data-provider-active="${provider.id}" data-next-active="true">Unblock</button>`;
    return `<tr>
      <td><strong>${providerEscape(provider.full_name)}</strong><small>#${provider.id}</small></td>
      <td>${providerEscape(provider.email)}<small>${providerEscape(provider.phone || 'No phone provided')}</small></td>
      <td>${provider.package_count}</td>
      <td>${provider.booking_count}</td>
      <td>${providerEscape(provider.created_at)}</td>
      <td><span class="admin-account-status ${badgeClass}">${providerEscape(label)}</span></td>
      <td><div class="admin-customer-actions">
        <button type="button" class="btn btn-secondary btn-small" data-provider-details="${provider.id}">Details</button>
        ${approvalActions}
        ${accessAction}
      </div></td>
    </tr>`;
  }).join('');
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
    panel.innerHTML = `<h2>Provider details</h2>
      <p><strong>Name:</strong> ${providerEscape(provider.full_name)}</p>
      <p><strong>Email:</strong> ${providerEscape(provider.email)}</p>
      <p><strong>Phone:</strong> ${providerEscape(provider.phone || 'Not provided')}</p>
      <p><strong>Provider approval:</strong> ${providerEscape(provider.provider_status)}</p>
      <p><strong>Account access:</strong> ${Number(provider.is_active) === 1 ? 'Active' : 'Blocked'}</p>
      <p><strong>Packages:</strong> ${provider.package_count}</p>
      <p><strong>Bookings:</strong> ${provider.booking_count}</p>
      <p><strong>Joined:</strong> ${providerEscape(provider.created_at)}</p>`;
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
