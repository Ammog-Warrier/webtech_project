(() => {
  const rows = byId('rows');
  const note = byId('page-status');

  // Plain-language names; the setting keys themselves are what the API uses.
  const LABELS = {
    maintenance_mode: 'Maintenance mode',
    booking_cancellation_hours_limit: 'Cancellation cutoff (hours before departure)',
  };

  function valueControl(setting) {
    if (setting.setting_key === 'maintenance_mode') {
      const select = el('select');
      [['false', 'Off'], ['true', 'On']].forEach(([value, text]) => {
        const option = el('option', null, text);
        option.value = value;
        select.append(option);
      });
      select.value = setting.setting_value;
      select.setAttribute('aria-label', LABELS.maintenance_mode);
      return select;
    }
    const input = el('input');
    input.type = 'number';
    input.min = '0';
    input.max = '720';
    input.step = '1';
    input.value = setting.setting_value;
    input.setAttribute('aria-label', LABELS[setting.setting_key] || setting.setting_key);
    return input;
  }

  async function save(setting, control) {
    showError(byId('page-error'), '');
    if (setting.setting_key === 'maintenance_mode' && control.value === 'true'
      && !window.confirm('Turn on maintenance mode? Customers and providers will be blocked until it is switched off.')) {
      control.value = setting.setting_value;
      return;
    }
    try {
      await apiFetch(`/superadmin/settings/${encodeURIComponent(setting.setting_key)}`, { method: 'PUT', body: { value: control.value } });
      setNote(note, `${LABELS[setting.setting_key] || setting.setting_key} saved.`);
      await load(true);
    } catch (err) {
      showError(byId('page-error'), err.message);
    }
  }

  function settingRow(setting) {
    const control = valueControl(setting);
    const tr = el('tr');
    tr.append(
      cellWithSub(LABELS[setting.setting_key] || setting.setting_key, setting.description),
      cell(control),
      cell(setting.updated_at),
      cell(button('Save', 'btn-primary', () => save(setting, control)))
    );
    return tr;
  }

  async function load(keepNote) {
    if (!keepNote) setNote(note, 'Loading settings…');
    try {
      const settings = await apiFetch('/superadmin/settings');
      fillTable(rows, settings.map(settingRow), 4, 'No settings found.');
      if (!keepNote) setNote(note, `${settings.length} setting(s).`);
    } catch (err) {
      setNote(note, 'Unable to load settings.', true);
      showError(byId('page-error'), err.message);
    }
  }

  guardPage(['SUPER_ADMIN']).then((user) => { if (user) load(); });
})();
