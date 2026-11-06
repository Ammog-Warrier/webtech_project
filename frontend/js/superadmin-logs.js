(() => {
  const state = { page: 1 };
  const rows = byId('rows');
  const note = byId('page-status');

  function logRow(log) {
    const tr = el('tr');
    tr.append(
      cell(log.created_at),
      cellWithSub(log.user_name || 'Unknown', `${log.user_email || ''} · ${String(log.user_role || '').replace('_', ' ')}`),
      cell(log.action),
      cell(log.entity ? `${log.entity}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'),
      cell(log.details || '—')
    );
    return tr;
  }

  async function load() {
    showError(byId('page-error'), '');
    setNote(note, 'Loading logs…');
    try {
      const result = await apiFetch(`/superadmin/logs${queryString({
        search: byId('search').value.trim(), action: byId('action').value.trim(), entity: byId('entity').value.trim(),
        from: byId('from').value, to: byId('to').value, page: state.page, limit: 20,
      })}`);
      fillTable(rows, result.items.map(logRow), 5, 'No log entries match these filters.');
      renderPager(byId('pager'), result, (page) => { state.page = page; load(); });
      setNote(note, `${result.total} log entr${result.total === 1 ? 'y' : 'ies'} found.`);
    } catch (err) {
      setNote(note, 'Unable to load logs.', true);
      showError(byId('page-error'), err.message);
    }
  }

  function applyFilters() {
    state.page = 1;
    load();
  }

  let timer;
  ['search', 'action', 'entity'].forEach((id) => byId(id).addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(applyFilters, 300);
  }));
  ['from', 'to'].forEach((id) => byId(id).addEventListener('change', applyFilters));
  byId('filters').addEventListener('submit', (event) => event.preventDefault());
  byId('refresh').addEventListener('click', load);

  guardPage(['SUPER_ADMIN']).then((user) => { if (user) load(); });
})();
