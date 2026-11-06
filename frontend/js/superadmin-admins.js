(() => {
  const state = { page: 1, editingId: null, permissionsFor: null };
  const rows = byId('rows');
  const note = byId('page-status');
  const formPanel = byId('admin-form-panel');
  const permissionPanel = byId('permission-panel');

  function adminRow(admin) {
    const active = Number(admin.is_active) === 1;
    const actions = el('div', 'admin-customer-actions');
    actions.append(
      button('Edit', 'btn-secondary', () => openForm(admin)),
      button('Permissions', 'btn-secondary', () => openPermissions(admin)),
      button(active ? 'Disable' : 'Enable', active ? 'btn-danger' : 'btn-primary', () => toggleActive(admin, !active)),
      button('Delete', 'btn-danger', () => removeAdmin(admin))
    );
    const tr = el('tr');
    tr.append(
      cellWithSub(admin.full_name, `#${admin.id}`),
      cellWithSub(admin.email, admin.phone || 'No phone provided'),
      cell(`${admin.permission_count} granted`),
      cell(admin.created_at),
      cell(statusPill(active ? 'ACTIVE' : 'DISABLED')),
      cell(actions)
    );
    return tr;
  }

  async function load() {
    showError(byId('page-error'), '');
    setNote(note, 'Loading admin accounts…');
    try {
      const result = await apiFetch(`/superadmin/admins${queryString({
        search: byId('search').value.trim(), status: byId('status').value, page: state.page, limit: PAGE_SIZE,
      })}`);
      fillTable(rows, result.items.map(adminRow), 6, 'No admin accounts match these filters.');
      renderPager(byId('pager'), result, (page) => { state.page = page; load(); });
      setNote(note, `${result.total} admin account(s) found.`);
    } catch (err) {
      setNote(note, 'Unable to load admin accounts.', true);
      showError(byId('page-error'), err.message);
    }
  }

  function openForm(admin) {
    state.editingId = admin ? admin.id : null;
    permissionPanel.hidden = true;
    byId('admin-form-title').textContent = admin ? `Edit ${admin.full_name}` : 'New admin';
    byId('admin-save').textContent = admin ? 'Save changes' : 'Create admin';
    byId('admin-password-label').textContent = admin ? 'New password (leave blank to keep the current one)' : 'Password (8-72 characters)';
    byId('admin-name').value = admin ? admin.full_name : '';
    byId('admin-email').value = admin ? admin.email : '';
    byId('admin-phone').value = admin && admin.phone ? admin.phone : '';
    byId('admin-password').value = '';
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    byId('admin-name').focus();
  }

  function closeForm() {
    formPanel.hidden = true;
    state.editingId = null;
  }

  async function saveForm(event) {
    event.preventDefault();
    showError(byId('page-error'), '');
    const body = {
      full_name: byId('admin-name').value.trim(),
      email: byId('admin-email').value.trim(),
      phone: byId('admin-phone').value.trim() || null,
    };
    const password = byId('admin-password').value;
    if (password) body.password = password;
    if (!body.full_name || !body.email) return showError(byId('page-error'), 'Name and email are required.');
    if (!state.editingId && !password) return showError(byId('page-error'), 'A password is required for a new admin.');
    if (password && (password.length < 8 || password.length > 72)) return showError(byId('page-error'), 'Password must be 8-72 characters.');
    try {
      if (state.editingId) {
        await apiFetch(`/superadmin/admins/${state.editingId}`, { method: 'PUT', body });
        setNote(note, 'Admin updated.');
      } else {
        await apiFetch('/superadmin/admins', { method: 'POST', body });
        setNote(note, 'Admin created. Open Permissions to grant access.');
      }
      closeForm();
      await load();
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  async function toggleActive(admin, isActive) {
    if (!window.confirm(`${isActive ? 'Enable' : 'Disable'} ${admin.full_name}?`)) return;
    try {
      await apiFetch(`/superadmin/admins/${admin.id}/status`, { method: 'PATCH', body: { is_active: isActive } });
      setNote(note, `${admin.full_name} was ${isActive ? 'enabled' : 'disabled'}.`);
      await load();
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  async function removeAdmin(admin) {
    if (!window.confirm(`Delete ${admin.full_name}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/superadmin/admins/${admin.id}`, { method: 'DELETE' });
      setNote(note, `${admin.full_name} was deleted.`);
      await load();
    } catch (err) {
      showError(byId('page-error'), err.status === 409 ? `${err.message} Disable the account instead.` : err.message);
    }
  }

  async function openPermissions(admin) {
    showError(byId('page-error'), '');
    try {
      const [all, current] = await Promise.all([
        apiFetch('/superadmin/permissions'),
        apiFetch(`/superadmin/admins/${admin.id}/permissions`),
      ]);
      state.permissionsFor = admin.id;
      byId('permission-title').textContent = `Permissions for ${admin.full_name}`;
      const list = byId('permission-list');
      list.replaceChildren(...all.map((permission) => {
        const label = el('label', 'permission-item');
        const box = el('input');
        box.type = 'checkbox';
        box.value = permission.name;
        box.checked = current.permissions.includes(permission.name);
        const text = el('span');
        text.append(el('strong', null, permission.name.replace(/_/g, ' ')), el('small', null, permission.description));
        label.append(box, text);
        return label;
      }));
      closeForm();
      permissionPanel.hidden = false;
      permissionPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  async function savePermissions() {
    const chosen = [...byId('permission-list').querySelectorAll('input:checked')].map((box) => box.value);
    try {
      await apiFetch(`/superadmin/admins/${state.permissionsFor}/permissions`, { method: 'PUT', body: { permissions: chosen } });
      setNote(note, 'Permissions saved.');
      permissionPanel.hidden = true;
      await load();
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  function applyFilters() {
    state.page = 1;
    load();
  }

  byId('filters').addEventListener('submit', (event) => event.preventDefault());
  byId('search').addEventListener('input', applyFilters);
  byId('status').addEventListener('change', applyFilters);
  byId('refresh').addEventListener('click', load);
  byId('new-admin').addEventListener('click', () => openForm(null));
  byId('admin-form').addEventListener('submit', saveForm);
  byId('admin-cancel').addEventListener('click', closeForm);
  byId('permission-save').addEventListener('click', savePermissions);
  byId('permission-cancel').addEventListener('click', () => { permissionPanel.hidden = true; });

  guardPage(['SUPER_ADMIN']).then((user) => { if (user) load(); });
})();
