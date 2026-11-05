let latestProviderReport = null;

function reportCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function reportCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value == null || value === '' ? '—' : String(value);
  return cell;
}

function reportRow(values) {
  const row = document.createElement('tr');
  values.forEach((value) => row.append(reportCell(value)));
  return row;
}

function setReportMessage(message, isError = false) {
  const box = document.getElementById('report-message');
  box.textContent = message || '';
  box.className = message
    ? `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'} show`
    : 'auth-alert';
}

function fillReportTable(id, rows, emptyMessage, columns) {
  const body = document.getElementById(id);
  body.replaceChildren();
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = reportCell(emptyMessage);
    cell.colSpan = columns;
    row.append(cell);
    body.append(row);
    return;
  }
  rows.forEach((row) => body.append(row));
}

function renderProviderReport(report) {
  const s = report.summary;
  document.getElementById('report-bookings').textContent = s.total_bookings;
  document.getElementById('report-completed').textContent = s.completed_bookings;
  document.getElementById('report-cancelled').textContent = s.cancelled_bookings;
  document.getElementById('report-guests').textContent = s.guests;
  document.getElementById('report-paid').textContent = reportCurrency(s.paid_total);
  document.getElementById('report-refunded').textContent = reportCurrency(s.refunded_total);
  document.getElementById('report-net').textContent = reportCurrency(s.net_total);
  document.getElementById('report-payments').textContent = s.payment_count;

  fillReportTable('monthly-report-rows', report.monthly.map((item) => reportRow([
    item.month, item.bookings, item.completed, item.cancelled,
    reportCurrency(item.paid), reportCurrency(item.refunded),
  ])), 'No activity for this period.', 6);

  fillReportTable('package-report-rows', report.packages.map((item) => reportRow([
    item.package_title, item.bookings, item.guests, item.completed,
    item.cancelled, reportCurrency(item.net),
  ])), 'No packages found.', 6);

  fillReportTable('departure-report-rows', report.departures.map((item) => reportRow([
    item.package_title, formatReportDate(item.start_date),
    item.seats_booked, item.seats_total, item.seats_available,
    `${item.occupancy_percent}%`,
  ])), 'No departures found for this period.', 6);
}

function formatReportDate(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  // MySQL DATE values are often returned as UTC-midnight Date objects.
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('en-IN');
}

async function loadProviderReport() {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-reports.html');
    return;
  }
  try {
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('/login.html?redirect=%2Fprovider-reports.html');
      return;
    }
    if (user.role !== 'PROVIDER') {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }

    const from = document.getElementById('report-from').value;
    const to = document.getElementById('report-to').value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const report = await apiFetch(`/provider/reports${suffix}`);
    latestProviderReport = report;
    renderProviderReport(report);
    setReportMessage('Business report loaded.');
    if (typeof syncNavbarAuth === 'function') syncNavbarAuth();
  } catch (err) {
    setReportMessage(err.message || 'Unable to load business report.', true);
  }
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportProviderReport() {
  if (!latestProviderReport) {
    setReportMessage('Load a report before exporting.', true);
    return;
  }
  const report = latestProviderReport;
  const rows = [
    ['Local Tourism Provider Report'],
    ['From', report.filters.from || 'All time', 'To', report.filters.to || 'All time'],
    [],
    ['Business overview'],
    ['Metric', 'Value'],
    ['Total bookings', report.summary.total_bookings],
    ['Pending bookings', report.summary.pending_bookings],
    ['Confirmed bookings', report.summary.confirmed_bookings],
    ['Completed bookings', report.summary.completed_bookings],
    ['Cancelled bookings', report.summary.cancelled_bookings],
    ['Guests', report.summary.guests],
    ['Paid revenue', report.summary.paid_total],
    ['Refunded', report.summary.refunded_total],
    ['Net collected', report.summary.net_total],
    [],
    ['Monthly trends'],
    ['Month', 'Bookings', 'Completed', 'Cancelled', 'Paid', 'Refunded'],
    ...report.monthly.map((item) => [
      item.month, item.bookings, item.completed, item.cancelled, item.paid, item.refunded,
    ]),
    [],
    ['Package performance'],
    ['Package', 'Bookings', 'Guests', 'Completed', 'Cancelled', 'Net collected'],
    ...report.packages.map((item) => [
      item.package_title, item.bookings, item.guests, item.completed, item.cancelled, item.net,
    ]),
    [],
    ['Departure occupancy'],
    ['Package', 'Departure', 'Seats booked', 'Capacity', 'Available', 'Occupancy %'],
    ...report.departures.map((item) => [
      item.package_title, formatReportDate(item.start_date), item.seats_booked,
      item.seats_total, item.seats_available, item.occupancy_percent,
    ]),
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'provider-business-report.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('apply-report-filter').addEventListener('click', loadProviderReport);
  document.getElementById('clear-report-filter').addEventListener('click', () => {
    document.getElementById('report-from').value = '';
    document.getElementById('report-to').value = '';
    loadProviderReport();
  });
  document.getElementById('export-report').addEventListener('click', exportProviderReport);
  loadProviderReport();
});
