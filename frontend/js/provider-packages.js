function showPackageAlert(message, type = 'error') {
  const box = document.getElementById('provider-packages-alert');
  box.textContent = message;
  box.className = `auth-alert auth-alert-${type} show`;
}

function clearPackageAlert() {
  const box = document.getElementById('provider-packages-alert');
  box.textContent = '';
  box.className = 'auth-alert';
}

let providerPackageOptions = { destinations: [], categories: [] };
let editingPackageId = null;

function fillSelect(select, items, placeholder) {
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function resetPackageForm() {
  editingPackageId = null;
  document.getElementById('provider-package-form').reset();
  document.querySelector('[name="max_group_size"]').value = 12;
  document.getElementById('package-editor-title').textContent = 'Create package';
  document.getElementById('save-package-btn').textContent = 'Create package';
  document.getElementById('package-editor').hidden = true;
}

function openPackageForm(pkg = null) {
  resetPackageForm();
  const editor = document.getElementById('package-editor');
  if (pkg) {
    editingPackageId = pkg.id;
    const form = document.getElementById('provider-package-form');
    Object.entries({
      title: pkg.title,
      destination_id: pkg.destination_id,
      category_id: pkg.category_id || '',
      price: pkg.price,
      duration_days: pkg.duration_days,
      max_group_size: pkg.max_group_size,
      image_url: pkg.image_url,
      description: pkg.description,
      itinerary: pkg.itinerary || '',
      inclusions: pkg.inclusions || '',
    }).forEach(([name, value]) => { form.elements[name].value = value; });
    document.getElementById('package-editor-title').textContent = 'Edit package';
    document.getElementById('save-package-btn').textContent = 'Save changes';
  }
  editor.hidden = false;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProviderPackages(packages) {
  const list = document.getElementById('provider-package-list');
  list.replaceChildren();
  if (!packages.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'You have not created any packages yet.';
    list.appendChild(empty);
    return;
  }

  packages.forEach((pkg) => {
    const card = document.createElement('article');
    card.className = 'provider-package-card';
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = pkg.title;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `${pkg.destination_name} · ${pkg.category_name || 'Uncategorized'} · ₹${Number(pkg.price).toLocaleString('en-IN')} · ${pkg.duration_days} day(s)`;
    const status = document.createElement('span');
    status.className = `package-status package-status-${pkg.status.toLowerCase()}`;
    status.textContent = pkg.status;
    details.append(title, meta, status);
    const actions = document.createElement('div');
    actions.className = 'provider-package-actions';
    if (pkg.status !== 'ARCHIVED') {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-secondary';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openPackageForm(pkg));
      const archive = document.createElement('button');
      archive.type = 'button';
      archive.className = 'btn btn-danger';
      archive.textContent = 'Delete';
      archive.addEventListener('click', async () => {
        if (!window.confirm(`Archive "${pkg.title}"? It will no longer be publicly listed.`)) return;
        try {
          await apiFetch(`/provider/packages/${pkg.id}`, { method: 'DELETE' });
          showPackageAlert('Package archived successfully.', 'success');
          await loadProviderPackages();
        } catch (err) {
          showPackageAlert(err.message);
        }
      });
      actions.append(edit, archive);
    }
    card.append(details, actions);
    list.appendChild(card);
  });
}

async function loadProviderPackages() {
  const packages = await apiFetch('/provider/packages');
  renderProviderPackages(packages);
}

async function initProviderPackages() {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-packages.html');
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
      showPackageAlert(`Provider approval required. Current status: ${user.provider_status}.`, 'error');
      document.getElementById('new-package-btn').disabled = true;
      return;
    }

    providerPackageOptions = await apiFetch('/provider/package-options');
    fillSelect(document.querySelector('[name="destination_id"]'), providerPackageOptions.destinations, 'Choose destination');
    fillSelect(document.querySelector('[name="category_id"]'), providerPackageOptions.categories, 'Uncategorized');
    await loadProviderPackages();
  } catch (err) {
    showPackageAlert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-package-btn').addEventListener('click', () => openPackageForm());
  document.getElementById('cancel-edit-btn').addEventListener('click', resetPackageForm);
  document.getElementById('provider-package-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearPackageAlert();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    body.destination_id = Number(body.destination_id);
    body.category_id = body.category_id ? Number(body.category_id) : null;
    body.price = Number(body.price);
    body.duration_days = Number(body.duration_days);
    body.max_group_size = Number(body.max_group_size);
    const button = document.getElementById('save-package-btn');
    button.disabled = true;
    try {
      await apiFetch(editingPackageId ? `/provider/packages/${editingPackageId}` : '/provider/packages', {
        method: editingPackageId ? 'PUT' : 'POST',
        body,
      });
      showPackageAlert(editingPackageId
        ? 'Package updated and submitted for admin approval.'
        : 'Package created and submitted for admin approval.', 'success');
      resetPackageForm();
      await loadProviderPackages();
    } catch (err) {
      showPackageAlert(err.message);
    } finally {
      button.disabled = false;
    }
  });
  initProviderPackages();
});
