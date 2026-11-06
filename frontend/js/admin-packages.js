(() => {
  const state = { page: 1, selected: null };
  const rows = byId('rows');
  const note = byId('page-status');
  const detail = byId('detail');

  function packageRow(pkg) {
    const tr = el('tr');
    if (state.selected === pkg.id) tr.className = 'is-selected';
    tr.append(
      cellWithSub(pkg.title, `#${pkg.id}`),
      cellWithSub(pkg.provider_name || 'Unassigned', pkg.provider_email),
      cell(pkg.destination_name),
      cell(formatMoney(pkg.price)),
      cell(statusPill(pkg.status)),
      cell(pkg.created_at),
      cell(button('Review', 'btn-secondary', () => openDetail(pkg.id)))
    );
    return tr;
  }

  async function load() {
    showError(byId('page-error'), '');
    setNote(note, 'Loading packages…');
    try {
      const result = await apiFetch(`/admin/packages${queryString({
        search: byId('search').value.trim(), status: byId('status').value, page: state.page, limit: PAGE_SIZE,
      })}`);
      fillTable(rows, result.items.map(packageRow), 7, 'No packages match these filters.');
      renderPager(byId('pager'), result, (page) => { state.page = page; load(); });
      setNote(note, `${result.total} package(s) found.`);
    } catch (err) {
      setNote(note, 'Unable to load packages.', true);
      showError(byId('page-error'), err.message);
    }
  }

  async function moderate(pkg, status, reason) {
    try {
      await apiFetch(`/admin/packages/${pkg.id}/status`, {
        method: 'PATCH',
        body: status === 'REJECTED' ? { status, rejection_reason: reason } : { status },
      });
      setNote(note, `"${pkg.title}" was ${status === 'APPROVED' ? 'approved' : 'rejected'}.`);
      await load();
      await openDetail(pkg.id);
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  async function openDetail(id) {
    state.selected = id;
    try {
      const pkg = await apiFetch(`/admin/packages/${id}`);
      const reason = el('textarea');
      reason.rows = 2;
      reason.maxLength = 255;
      reason.placeholder = 'Optional reason shown to the provider';
      reason.value = pkg.rejection_reason || '';

      const actions = el('div', 'button-group');
      if (pkg.status !== 'ARCHIVED') {
        if (pkg.status !== 'APPROVED') actions.append(button('Approve', 'btn-primary', () => moderate(pkg, 'APPROVED')));
        if (pkg.status !== 'REJECTED') actions.append(button('Reject', 'btn-danger', () => moderate(pkg, 'REJECTED', reason.value.trim())));
      }

      detail.replaceChildren(
        el('h3', null, pkg.title),
        detailLine('Status', pkg.status),
        detailLine('Provider', `${pkg.provider_name || 'Unassigned'} (${pkg.provider_email || '—'})`),
        detailLine('Destination', pkg.destination_name),
        detailLine('Category', pkg.category_name || 'None'),
        detailLine('Price', `${formatMoney(pkg.price)} per guest · ${pkg.duration_days} day(s) · up to ${pkg.max_group_size} guests`),
        detailLine('Departures scheduled', pkg.departure_count),
        el('p', null, pkg.description),
        el('strong', null, 'Itinerary'), el('pre', null, pkg.itinerary || '—'),
        el('strong', null, 'Inclusions'), el('pre', null, pkg.inclusions || '—'),
        pkg.status === 'ARCHIVED' ? el('p', 'muted', 'Archived packages cannot be moderated.') : labeledField('Rejection reason', reason, 'reject-reason'),
        actions
      );
      detail.hidden = false;
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  guardPage(['ADMIN', 'SUPER_ADMIN'], 'MODERATE_PACKAGES').then((user) => { if (user) load(); });
})();
