function escapeDestinationHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function setDestinationStatus(message, isError = false) {
  const status = document.getElementById('destination-status');
  status.textContent = message;
  status.classList.toggle('admin-dashboard-status-error', isError);
}

function showDestinationError(message) {
  const error = document.getElementById('destination-error');
  error.textContent = message;
  error.className = 'auth-alert auth-alert-error show';
}

function clearDestinationError() {
  const error = document.getElementById('destination-error');
  error.textContent = '';
  error.className = 'auth-alert';
}

function renderDestinations(destinations) {
  const body = document.getElementById('destination-table-body');
  if (!destinations.length) {
    body.innerHTML = '<tr><td colspan="5">No destinations found.</td></tr>';
    return;
  }

  body.innerHTML = destinations.map((destination) => `
    <tr>
      <td><strong>${escapeDestinationHtml(destination.name)}</strong><small>#${destination.id}</small></td>
      <td>${escapeDestinationHtml(destination.description)}</td>
      <td>${destination.package_count}</td>
      <td>${escapeDestinationHtml(destination.created_at)}</td>
      <td><div class="admin-customer-actions">
        <button type="button" class="btn btn-secondary btn-small" data-edit-destination="${destination.id}">Edit</button>
        <button type="button" class="btn btn-danger btn-small" data-delete-destination="${destination.id}">Delete</button>
      </div></td>
    </tr>
  `).join('');
}

async function loadDestinations() {
  const refresh = document.getElementById('refresh-destinations');
  clearDestinationError();
  refresh.disabled = true;
  setDestinationStatus('Loading destinations…');
  try {
    const search = document.getElementById('destination-search').value.trim();
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const destinations = await apiFetch(`/admin/destinations${query}`);
    renderDestinations(destinations);
    setDestinationStatus(`${destinations.length} destination(s) found.`);
  } catch (err) {
    setDestinationStatus('Unable to load destinations.', true);
    showDestinationError(err.message || 'Unable to load destinations.');
  } finally {
    refresh.disabled = false;
  }
}

function resetDestinationForm() {
  document.getElementById('destination-form').reset();
  document.getElementById('destination-id').value = '';
  document.getElementById('destination-form-title').textContent = 'Add destination';
  document.getElementById('save-destination').textContent = 'Save destination';
  document.getElementById('destination-form-section').hidden = true;
}

function openNewDestinationForm() {
  clearDestinationError();
  resetDestinationForm();
  document.getElementById('destination-form-section').hidden = false;
  document.getElementById('destination-form-title').textContent = 'Add destination';
  document.getElementById('destination-name').focus();
}

async function openEditDestinationForm(destinationId) {
  clearDestinationError();
  try {
    const destination = await apiFetch(`/admin/destinations/${destinationId}`);
    document.getElementById('destination-id').value = destination.id;
    document.getElementById('destination-name').value = destination.name;
    document.getElementById('destination-description').value = destination.description;
    document.getElementById('destination-image').value = destination.image_url;
    document.getElementById('destination-form-title').textContent = 'Edit destination';
    document.getElementById('save-destination').textContent = 'Update destination';
    document.getElementById('destination-form-section').hidden = false;
    document.getElementById('destination-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showDestinationError(err.message || 'Unable to load destination details.');
  }
}

async function saveDestination(event) {
  event.preventDefault();
  clearDestinationError();

  const id = document.getElementById('destination-id').value;
  const payload = {
    name: document.getElementById('destination-name').value.trim(),
    description: document.getElementById('destination-description').value.trim(),
    image_url: document.getElementById('destination-image').value.trim(),
  };
  const save = document.getElementById('save-destination');
  save.disabled = true;

  try {
    await apiFetch(id ? `/admin/destinations/${id}` : '/admin/destinations', {
      method: id ? 'PUT' : 'POST',
      body: payload,
    });
    resetDestinationForm();
    setDestinationStatus(id ? 'Destination updated successfully.' : 'Destination created successfully.');
    await loadDestinations();
  } catch (err) {
    showDestinationError(err.message || 'Unable to save destination.');
  } finally {
    save.disabled = false;
  }
}

async function deleteDestination(destinationId) {
  const row = document.querySelector(`[data-delete-destination="${destinationId}"]`)?.closest('tr');
  const destinationName = row?.querySelector('td strong')?.textContent || 'this destination';
  if (!window.confirm(`Delete "${destinationName}"? This cannot be undone.`)) return;

  clearDestinationError();
  try {
    await apiFetch(`/admin/destinations/${destinationId}`, { method: 'DELETE' });
    setDestinationStatus('Destination deleted successfully.');
    await loadDestinations();
  } catch (err) {
    showDestinationError(err.message || 'Unable to delete destination.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fadmin-destinations.html');
    return;
  }
  const user = await fetchCurrentUser();
  if (!user) {
    window.location.replace('/login.html?redirect=%2Fadmin-destinations.html');
    return;
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    window.location.replace(getRoleDashboardUrl(user.role));
    return;
  }

  document.getElementById('refresh-destinations').addEventListener('click', loadDestinations);
  document.getElementById('new-destination').addEventListener('click', openNewDestinationForm);
  document.getElementById('cancel-destination').addEventListener('click', resetDestinationForm);
  document.getElementById('destination-form').addEventListener('submit', saveDestination);
  document.getElementById('destination-search').addEventListener('input', () => {
    window.clearTimeout(window.destinationSearchTimer);
    window.destinationSearchTimer = window.setTimeout(loadDestinations, 300);
  });
  document.getElementById('destination-table-body').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-destination]');
    const remove = event.target.closest('[data-delete-destination]');
    if (edit) openEditDestinationForm(edit.dataset.editDestination);
    if (remove) deleteDestination(remove.dataset.deleteDestination);
  });

  await loadDestinations();
});
