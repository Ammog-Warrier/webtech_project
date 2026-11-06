(() => {
  const state = { page: 1 };
  const rows = byId('rows');
  const note = byId('page-status');
  const detail = byId('detail');

  function bookingRow(b) {
    const tr = el('tr');
    tr.append(
      cellWithSub(`#${b.id}`, b.booked_at),
      cellWithSub(b.customer_name, b.customer_email),
      cellWithSub(b.package_title, `${b.destination_name} · ${b.provider_name || 'Unassigned'}`),
      cell(b.departure_date),
      cell(b.num_guests),
      cell(formatMoney(b.total_price)),
      cell(statusPill(b.status)),
      cell(statusPill(b.payment_status)),
      cell(button('Details', 'btn-secondary', () => showDetail(b)))
    );
    return tr;
  }

  function showDetail(b) {
    detail.replaceChildren(
      el('h3', null, `Booking #${b.id}`),
      detailLine('Customer', `${b.customer_name} (${b.customer_email}${b.customer_phone ? `, ${b.customer_phone}` : ''})`),
      detailLine('Package', `${b.package_title} · ${b.destination_name} · ${b.duration_days} day(s)`),
      detailLine('Provider', b.provider_name || 'Unassigned'),
      detailLine('Departure', b.departure_date),
      detailLine('Guests', b.num_guests),
      detailLine('Total price', formatMoney(b.total_price)),
      detailLine('Booking status', b.status),
      detailLine('Payment', b.payment_status === 'UNPAID' ? 'Not paid yet' : `${b.payment_status} · ${formatMoney(b.payment_amount)} by ${String(b.payment_method).replace('_', ' ')} on ${b.paid_at}`),
      detailLine('Review', b.review_rating ? `${b.review_rating}/5${b.review_comment ? ` — ${b.review_comment}` : ''}` : 'No review')
    );
    detail.hidden = false;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function load() {
    showError(byId('page-error'), '');
    setNote(note, 'Loading bookings…');
    try {
      const result = await apiFetch(`/admin/bookings${queryString({
        search: byId('search').value.trim(),
        status: byId('status').value,
        payment_status: byId('payment').value,
        from: byId('from').value,
        to: byId('to').value,
        page: state.page,
        limit: PAGE_SIZE,
      })}`);
      fillTable(rows, result.items.map(bookingRow), 9, 'No bookings match these filters.');
      renderPager(byId('pager'), result, (page) => { state.page = page; load(); });
      setNote(note, `${result.total} booking(s) found.`);
      detail.hidden = true;
    } catch (err) {
      setNote(note, 'Unable to load bookings.', true);
      showError(byId('page-error'), err.message);
    }
  }

  function applyFilters() {
    state.page = 1;
    load();
  }

  byId('filters').addEventListener('submit', (event) => event.preventDefault());
  ['search'].forEach((id) => byId(id).addEventListener('input', applyFilters));
  ['status', 'payment', 'from', 'to'].forEach((id) => byId(id).addEventListener('change', applyFilters));
  byId('refresh').addEventListener('click', load);

  guardPage(['ADMIN', 'SUPER_ADMIN'], 'VIEW_BOOKINGS').then((user) => { if (user) load(); });
})();
