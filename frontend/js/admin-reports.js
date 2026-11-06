(() => {
  const note = byId('page-status');

  function statCard(label, value, sub) {
    const card = el('article', 'admin-stat-card');
    card.append(el('span', null, label), el('strong', null, String(value)));
    if (sub) card.append(el('small', null, sub));
    return card;
  }

  function simpleRows(tbody, items, columns, emptyText, build) {
    fillTable(tbody, items.map((item) => {
      const tr = el('tr');
      tr.append(...build(item));
      return tr;
    }), columns, emptyText);
  }

  function render(report) {
    const s = report.summary;
    byId('summary-cards').replaceChildren(
      statCard('Bookings', s.total_bookings, `${s.confirmed_bookings} confirmed · ${s.completed_bookings} completed`),
      statCard('Pending / cancelled', `${s.pending_bookings} / ${s.cancelled_bookings}`),
      statCard('Guests travelling', s.guests, 'excluding cancelled bookings'),
      statCard('New accounts', `${s.new_customers} / ${s.new_providers}`, 'customers / providers'),
      statCard('Revenue (paid)', formatMoney(s.paid_total), 'money still held'),
      statCard('Refunded', formatMoney(s.refunded_total)),
      statCard('Gross taken', formatMoney(s.gross_total), 'paid + refunded'),
      statCard('Net revenue', formatMoney(s.net_total))
    );
    simpleRows(byId('monthly-rows'), report.monthly, 5, 'No bookings in this period.',
      (m) => [cell(m.month), cell(m.bookings), cell(m.cancelled), cell(formatMoney(m.paid)), cell(formatMoney(m.refunded))]);
    simpleRows(byId('package-rows'), report.top_packages, 4, 'No data.',
      (p) => [cell(p.package_title), cell(p.bookings), cell(p.guests), cell(formatMoney(p.revenue))]);
    simpleRows(byId('provider-rows'), report.top_providers, 3, 'No data.',
      (p) => [cell(p.provider_name), cell(p.bookings), cell(formatMoney(p.revenue))]);
    simpleRows(byId('destination-rows'), report.destinations, 3, 'No data.',
      (d) => [cell(d.destination_name), cell(d.bookings), cell(formatMoney(d.revenue))]);
    simpleRows(byId('category-rows'), report.categories, 3, 'No data.',
      (c) => [cell(c.category_name), cell(c.bookings), cell(formatMoney(c.revenue))]);
    byId('catalogue-cards').replaceChildren(
      statCard('Packages pending', report.catalogue.PENDING),
      statCard('Packages approved', report.catalogue.APPROVED),
      statCard('Rejected / archived', `${report.catalogue.REJECTED} / ${report.catalogue.ARCHIVED}`)
    );
    byId('report').hidden = false;
  }

  async function load() {
    showError(byId('page-error'), '');
    setNote(note, 'Building report…');
    try {
      const report = await apiFetch(`/admin/reports${queryString({ from: byId('from').value, to: byId('to').value })}`);
      render(report);
      const range = report.filters.from || report.filters.to
        ? `${report.filters.from || 'start'} to ${report.filters.to || 'today'}` : 'all time';
      setNote(note, `Report for ${range}.`);
    } catch (err) {
      setNote(note, 'Unable to build the report.', true);
      showError(byId('page-error'), err.message);
    }
  }

  byId('filters').addEventListener('submit', (event) => {
    event.preventDefault();
    load();
  });
  byId('reset').addEventListener('click', () => {
    byId('from').value = '';
    byId('to').value = '';
    load();
  });

  guardPage(['ADMIN', 'SUPER_ADMIN'], 'VIEW_REPORTS').then((user) => { if (user) load(); });
})();
