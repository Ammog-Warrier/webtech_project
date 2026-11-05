// End-to-end API checks. Plain Node (no framework), run against a running server:
//   npm start            (in one terminal)
//   npm run test:api     (in another; set TEST_BASE_URL if the server is not on port 3000)
// Uses the demo accounts from database/seed.sql. Test data is removed at the end.
require('dotenv').config({ quiet: true });
const { pool } = require('../backend/config/db');

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const PASSWORD = 'Demo@1234';
const RUN = Date.now().toString(36);

let passed = 0;
let failed = 0;
const sections = [];
const cleanups = [];

function section(name, fn) {
  sections.push({ name, fn });
}

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${extra === undefined ? '' : ` -> ${JSON.stringify(extra)}`}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  return { status: res.status, body: json, data: json && json.data, error: json && json.error };
}

async function login(email, password = PASSWORD) {
  const res = await api('POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.data.token;
}

async function tokens() {
  return {
    customer: await login('customer@example.com'),
    provider: await login('provider@example.com'),
    admin: await login('admin@example.com'),
    superadmin: await login('superadmin@example.com'),
  };
}

// ---------------------------------------------------------------------------
section('Admin package moderation', async (t) => {
  const none = await api('GET', '/api/admin/packages');
  check('no token -> 401', none.status === 401);
  check('customer -> 403', (await api('GET', '/api/admin/packages', { token: t.customer })).status === 403);
  check('provider -> 403', (await api('GET', '/api/admin/packages', { token: t.provider })).status === 403);

  const title = `Moderation Test ${RUN}`;
  const created = await api('POST', '/api/provider/packages', {
    token: t.provider,
    body: {
      title, description: 'Test package', destination_id: 1, price: 99, duration_days: 2,
      max_group_size: 5, image_url: '/assets/img/cities.jpg',
    },
  });
  check('provider creates package -> 201/200 and PENDING', created.status < 300 && created.data.status === 'PENDING', created.body);
  const id = created.data.id;
  cleanups.push(() => pool.execute('DELETE FROM packages WHERE id = ?', [id]));

  const pending = await api('GET', '/api/admin/packages?status=PENDING', { token: t.admin });
  check('admin lists PENDING packages', pending.status === 200 && pending.data.some((p) => p.id === id));
  check('list rows include provider name', pending.data.find((p) => p.id === id).provider_name === 'Demo Provider');
  check('invalid status filter -> 400', (await api('GET', '/api/admin/packages?status=NOPE', { token: t.admin })).status === 400);

  const paged = await api('GET', '/api/admin/packages?page=1&limit=2', { token: t.admin });
  check('pagination shape', paged.status === 200 && Array.isArray(paged.data.items) && paged.data.items.length <= 2 && paged.data.total >= 1 && paged.data.limit === 2, paged.body);
  check('page=0 -> 400', (await api('GET', '/api/admin/packages?page=0', { token: t.admin })).status === 400);
  check('limit=1000 -> 400', (await api('GET', '/api/admin/packages?limit=1000', { token: t.admin })).status === 400);

  const search = await api('GET', `/api/admin/packages?search=${encodeURIComponent(title)}`, { token: t.superadmin });
  check('search by title (super admin allowed)', search.status === 200 && search.data.length === 1);

  const detail = await api('GET', `/api/admin/packages/${id}`, { token: t.admin });
  check('detail returns itinerary fields', detail.status === 200 && 'itinerary' in detail.data && detail.data.title === title);
  check('detail bad id -> 400', (await api('GET', '/api/admin/packages/abc', { token: t.admin })).status === 400);
  check('detail missing -> 404', (await api('GET', '/api/admin/packages/999999', { token: t.admin })).status === 404);

  const bad = await api('PATCH', `/api/admin/packages/${id}/status`, { token: t.admin, body: { status: 'ARCHIVED' } });
  check('invalid status value -> 400', bad.status === 400);
  const miss = await api('PATCH', '/api/admin/packages/999999/status', { token: t.admin, body: { status: 'APPROVED' } });
  check('moderate missing package -> 404', miss.status === 404);

  const rejected = await api('PATCH', `/api/admin/packages/${id}/status`, {
    token: t.admin, body: { status: 'REJECTED', rejection_reason: 'Needs a better description' },
  });
  check('reject with reason', rejected.status === 200 && rejected.data.status === 'REJECTED' && rejected.data.rejection_reason === 'Needs a better description', rejected.body);
  const mine = await api('GET', '/api/provider/packages', { token: t.provider });
  check('provider sees rejection reason', mine.data.find((p) => p.id === id).rejection_reason === 'Needs a better description');
  const hidden = await api('GET', '/api/packages');
  check('rejected package is not public', !hidden.data.some((p) => p.id === id));

  const approved = await api('PATCH', `/api/admin/packages/${id}/status`, { token: t.admin, body: { status: 'APPROVED' } });
  check('approve clears reason', approved.status === 200 && approved.data.status === 'APPROVED' && approved.data.rejection_reason === null, approved.body);
  const visible = await api('GET', '/api/packages');
  check('approved package is public', visible.data.some((p) => p.id === id));

  const edit = await api('PUT', `/api/provider/packages/${id}`, {
    token: t.provider,
    body: { title, description: 'Edited', destination_id: 1, price: 99, duration_days: 2, max_group_size: 5, image_url: '/assets/img/cities.jpg' },
  });
  check('provider edit resets to PENDING', edit.status === 200 && edit.data.status === 'PENDING', edit.body);

  await api('DELETE', `/api/provider/packages/${id}`, { token: t.provider });
  const archived = await api('PATCH', `/api/admin/packages/${id}/status`, { token: t.admin, body: { status: 'APPROVED' } });
  check('archived package cannot be moderated -> 409', archived.status === 409, archived.body);
});

// Creates a customer booking through the API and registers its cleanup.
async function makeBooking(t, { pay = false, guests = 1, packageId = 1 } = {}) {
  const deps = await api('GET', `/api/packages/${packageId}/departures`);
  const departure = deps.data[deps.data.length - 1];
  const created = await api('POST', '/api/bookings', {
    token: t.customer, body: { departure_id: departure.id, num_guests: guests },
  });
  if (created.status >= 300) throw new Error(`Booking failed: ${JSON.stringify(created.body)}`);
  const id = created.data.id;
  cleanups.push(async () => {
    await pool.execute('DELETE FROM reviews WHERE booking_id = ?', [id]);
    await pool.execute('DELETE FROM payments WHERE booking_id = ?', [id]);
    await pool.execute('DELETE FROM bookings WHERE id = ?', [id]);
  });
  if (pay) {
    const paid = await api('POST', `/api/bookings/${id}/pay`, { token: t.customer, body: { method: 'UPI' } });
    if (paid.status >= 300) throw new Error(`Payment failed: ${JSON.stringify(paid.body)}`);
  }
  return { id, departure };
}

section('Admin booking monitoring', async (t) => {
  check('no token -> 401', (await api('GET', '/api/admin/bookings')).status === 401);
  check('customer -> 403', (await api('GET', '/api/admin/bookings', { token: t.customer })).status === 403);
  check('provider -> 403', (await api('GET', '/api/admin/bookings', { token: t.provider })).status === 403);
  check('customer -> 403 on detail', (await api('GET', '/api/admin/bookings/1', { token: t.customer })).status === 403);

  const paid = await makeBooking(t, { pay: true, guests: 2 });
  const pending = await makeBooking(t, { pay: false });
  const cancelled = await makeBooking(t, { pay: true });
  const cancel = await api('POST', `/api/bookings/${cancelled.id}/cancel`, { token: t.customer });
  check('setup: cancel refunds payment', cancel.status === 200, cancel.body);

  const all = await api('GET', '/api/admin/bookings', { token: t.admin });
  check('admin lists all bookings', all.status === 200 && [paid, pending, cancelled].every((b) => all.data.some((x) => x.id === b.id)));
  const row = all.data.find((x) => x.id === paid.id);
  check('row has customer, package, provider and payment', row.customer_email === 'customer@example.com' && row.package_title && row.provider_name === 'Demo Provider' && row.payment_status === 'PAID' && row.status === 'CONFIRMED', row);

  const byStatus = await api('GET', '/api/admin/bookings?status=CANCELLED', { token: t.admin });
  check('status filter', byStatus.data.every((x) => x.status === 'CANCELLED') && byStatus.data.some((x) => x.id === cancelled.id));
  const unpaid = await api('GET', '/api/admin/bookings?payment_status=UNPAID', { token: t.admin });
  check('payment_status=UNPAID filter', unpaid.data.some((x) => x.id === pending.id) && unpaid.data.every((x) => x.payment_status === 'UNPAID'));
  const refunded = await api('GET', '/api/admin/bookings?payment_status=REFUNDED', { token: t.admin });
  check('payment_status=REFUNDED filter', refunded.data.some((x) => x.id === cancelled.id));
  const search = await api('GET', '/api/admin/bookings?search=customer@example.com', { token: t.superadmin });
  check('search by email (super admin allowed)', search.status === 200 && search.data.length >= 3);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const range = await api('GET', `/api/admin/bookings?from=${today}&to=${today}`, { token: t.admin });
  check('date range filter includes today\'s bookings', range.status === 200 && range.data.some((x) => x.id === paid.id));
  const future = await api('GET', '/api/admin/bookings?from=2999-01-01', { token: t.admin });
  check('future range is empty', future.status === 200 && future.data.length === 0);
  check('bad date -> 400', (await api('GET', '/api/admin/bookings?from=2026-13-40', { token: t.admin })).status === 400);
  check('from after to -> 400', (await api('GET', '/api/admin/bookings?from=2026-05-02&to=2026-05-01', { token: t.admin })).status === 400);
  check('bad status -> 400', (await api('GET', '/api/admin/bookings?status=X', { token: t.admin })).status === 400);
  check('bad payment_status -> 400', (await api('GET', '/api/admin/bookings?payment_status=X', { token: t.admin })).status === 400);
  const paged = await api('GET', '/api/admin/bookings?page=1&limit=2', { token: t.admin });
  check('pagination', paged.status === 200 && paged.data.items.length === 2 && paged.data.total >= 3);

  const detail = await api('GET', `/api/admin/bookings/${paid.id}`, { token: t.admin });
  check('detail', detail.status === 200 && detail.data.id === paid.id && detail.data.num_guests === 2);
  check('detail bad id -> 400', (await api('GET', '/api/admin/bookings/x', { token: t.admin })).status === 400);
  check('detail missing -> 404', (await api('GET', '/api/admin/bookings/99999999', { token: t.admin })).status === 404);
  const write = await api('POST', `/api/admin/bookings/${paid.id}/cancel`, { token: t.admin });
  check('admin cannot modify bookings (no write route)', write.status === 404);
});

section('Admin reports, net revenue and pagination', async (t) => {
  check('reports: no token -> 401', (await api('GET', '/api/admin/reports')).status === 401);
  check('reports: customer -> 403', (await api('GET', '/api/admin/reports', { token: t.customer })).status === 403);
  check('reports: provider -> 403', (await api('GET', '/api/admin/reports', { token: t.provider })).status === 403);
  check('reports: bad date -> 400', (await api('GET', '/api/admin/reports?from=nope', { token: t.admin })).status === 400);
  check('reports: from after to -> 400', (await api('GET', '/api/admin/reports?from=2026-02-01&to=2026-01-01', { token: t.admin })).status === 400);

  const future = await api('GET', '/api/admin/reports?from=2999-01-01', { token: t.admin });
  check('reports: empty range has zero totals and empty lists', future.status === 200 && future.data.summary.total_bookings === 0 && future.data.summary.paid_total === 0 && future.data.monthly.length === 0 && future.data.top_packages.length === 0, future.body);

  const before = (await api('GET', '/api/admin/reports', { token: t.superadmin })).data;
  const paid = await makeBooking(t, { pay: true, guests: 2 });
  const cancelled = await makeBooking(t, { pay: true, guests: 1, packageId: 2 });
  await api('POST', `/api/bookings/${cancelled.id}/cancel`, { token: t.customer });
  await makeBooking(t, { pay: false });
  const paidPrice = (await api('GET', `/api/admin/bookings/${paid.id}`, { token: t.admin })).data.total_price;
  const refundPrice = (await api('GET', `/api/admin/bookings/${cancelled.id}`, { token: t.admin })).data.total_price;

  const after = (await api('GET', '/api/admin/reports', { token: t.admin })).data;
  const diff = (key) => Math.round((after.summary[key] - before.summary[key]) * 100) / 100;
  check('report counts the 3 new bookings', diff('total_bookings') === 3, diff('total_bookings'));
  check('report counts 1 cancelled and 1 pending', diff('cancelled_bookings') === 1 && diff('pending_bookings') === 1);
  check('report paid_total grows by the paid booking', diff('paid_total') === Number(paidPrice), diff('paid_total'));
  check('report refunded_total grows by the refund', diff('refunded_total') === Number(refundPrice), diff('refunded_total'));
  check('net_total equals paid_total (refunds are not subtracted twice)', after.summary.net_total === after.summary.paid_total);
  check('gross_total = paid + refunded', Math.abs(after.summary.gross_total - (after.summary.paid_total + after.summary.refunded_total)) < 0.001);
  check('report has all sections', ['monthly', 'top_packages', 'top_providers', 'destinations', 'categories'].every((k) => Array.isArray(after[k])) && after.catalogue.APPROVED >= 1);
  check('top package/provider rows have names', after.top_packages[0].package_title && after.top_providers[0].provider_name);

  const dash = await api('GET', '/api/admin/dashboard', { token: t.admin });
  check('dashboard net_collected equals paid_revenue', dash.data.net_collected === dash.data.paid_revenue, dash.data);
  const fin = await api('GET', '/api/provider/finance', { token: t.provider });
  check('provider finance net_total equals paid_total', fin.status === 200 && fin.data.summary.refunded_total > 0 && fin.data.summary.net_total === fin.data.summary.paid_total, fin.body && fin.data.summary);
  const prep = await api('GET', '/api/provider/reports', { token: t.provider });
  check('provider report net_total equals paid_total', prep.status === 200 && prep.data.summary.net_total === prep.data.summary.paid_total);

  for (const path of ['customers', 'providers', 'destinations', 'categories']) {
    const url = `/api/admin/${path}`;
    const plain = await api('GET', url, { token: t.admin });
    check(`${path}: default response is still an array`, plain.status === 200 && Array.isArray(plain.data));
    const paged = await api('GET', `${url}?page=1&limit=1`, { token: t.admin });
    check(`${path}: ?page&limit returns pagination envelope`, paged.status === 200 && paged.data.items.length === 1 && paged.data.total === plain.data.length && paged.data.total_pages === plain.data.length, paged.body);
    check(`${path}: bad page -> 400`, (await api('GET', `${url}?page=abc`, { token: t.admin })).status === 400);
  }
  const beyond = await api('GET', '/api/admin/categories?page=99&limit=5', { token: t.admin });
  check('page beyond the end -> empty items', beyond.status === 200 && beyond.data.items.length === 0);
  const cat = await api('GET', '/api/admin/categories?search=Adventure', { token: t.admin });
  check('category search works', cat.status === 200 && cat.data.length === 1 && cat.data[0].name === 'Adventure', cat.body);
});

section('Super admin: admin accounts', async (t) => {
  const url = '/api/superadmin/admins';
  check('no token -> 401', (await api('GET', url)).status === 401);
  check('customer -> 403', (await api('GET', url, { token: t.customer })).status === 403);
  check('provider -> 403', (await api('GET', url, { token: t.provider })).status === 403);
  check('admin -> 403 (list)', (await api('GET', url, { token: t.admin })).status === 403);
  check('admin -> 403 (create)', (await api('POST', url, { token: t.admin, body: {} })).status === 403);

  const email = `new.admin.${RUN}@example.com`;
  const good = { full_name: 'Test Admin', email, phone: '9876543210', password: 'Secret@123' };
  check('missing name -> 400', (await api('POST', url, { token: t.superadmin, body: { ...good, full_name: '' } })).status === 400);
  check('bad email -> 400', (await api('POST', url, { token: t.superadmin, body: { ...good, email: 'nope' } })).status === 400);
  check('short password -> 400', (await api('POST', url, { token: t.superadmin, body: { ...good, password: 'short' } })).status === 400);
  check('missing password -> 400', (await api('POST', url, { token: t.superadmin, body: { ...good, password: undefined } })).status === 400);
  check('bad phone -> 400', (await api('POST', url, { token: t.superadmin, body: { ...good, phone: 'abc' } })).status === 400);

  const created = await api('POST', url, { token: t.superadmin, body: good });
  check('create admin -> 201', created.status === 201 && created.data.email === email && created.data.is_active === 1, created.body);
  check('response never contains a password hash', !JSON.stringify(created.body).includes('password'));
  const id = created.data.id;
  cleanups.push(async () => {
    await pool.execute('DELETE FROM audit_logs WHERE user_id = ?', [id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  });
  check('duplicate email -> 409', (await api('POST', url, { token: t.superadmin, body: good })).status === 409);

  const loggedIn = await api('POST', '/api/auth/login', { body: { email, password: 'Secret@123' } });
  check('new admin can log in with the ADMIN role', loggedIn.status === 200 && loggedIn.data.user.role === 'ADMIN', loggedIn.body);
  const adminToken = loggedIn.data.token;

  const list = await api('GET', `${url}?search=${encodeURIComponent(email)}`, { token: t.superadmin });
  check('list + search finds it', list.status === 200 && list.data.length === 1 && list.data[0].id === id);
  const all = await api('GET', url, { token: t.superadmin });
  check('list only contains ADMIN accounts', all.data.every((a) => a.email !== 'superadmin@example.com' && a.email !== 'customer@example.com') && all.data.some((a) => a.email === 'admin@example.com'));
  check('invalid status filter -> 400', (await api('GET', `${url}?status=X`, { token: t.superadmin })).status === 400);
  check('status=ACTIVE filter', (await api('GET', `${url}?status=ACTIVE`, { token: t.superadmin })).data.some((a) => a.id === id));
  const paged = await api('GET', `${url}?page=1&limit=1`, { token: t.superadmin });
  check('pagination', paged.status === 200 && paged.data.items.length === 1 && paged.data.total === all.data.length);

  const one = await api('GET', `${url}/${id}`, { token: t.superadmin });
  check('detail', one.status === 200 && one.data.full_name === 'Test Admin');
  check('detail bad id -> 400', (await api('GET', `${url}/abc`, { token: t.superadmin })).status === 400);
  check('detail missing -> 404', (await api('GET', `${url}/99999999`, { token: t.superadmin })).status === 404);
  check('customer id is not reachable here -> 404', (await api('GET', `${url}/1`, { token: t.superadmin })).status === 404);
  check('super admin id is not reachable here -> 404', (await api('GET', `${url}/4`, { token: t.superadmin })).status === 404);
  check('cannot disable a super admin here -> 404', (await api('PATCH', `${url}/4/status`, { token: t.superadmin, body: { is_active: false } })).status === 404);
  check('cannot delete a super admin here -> 404', (await api('DELETE', `${url}/4`, { token: t.superadmin })).status === 404);
  check('cannot delete a customer here -> 404', (await api('DELETE', `${url}/1`, { token: t.superadmin })).status === 404);

  const edited = await api('PUT', `${url}/${id}`, { token: t.superadmin, body: { full_name: 'Renamed Admin', email, phone: '' } });
  check('update keeps password when none given', edited.status === 200 && edited.data.full_name === 'Renamed Admin' && edited.data.phone === null);
  check('old password still works', (await api('POST', '/api/auth/login', { body: { email, password: 'Secret@123' } })).status === 200);
  check('update to an existing email -> 409', (await api('PUT', `${url}/${id}`, { token: t.superadmin, body: { full_name: 'X', email: 'customer@example.com' } })).status === 409);
  check('update bad body -> 400', (await api('PUT', `${url}/${id}`, { token: t.superadmin, body: { full_name: '' } })).status === 400);
  await api('PUT', `${url}/${id}`, { token: t.superadmin, body: { full_name: 'Renamed Admin', email, password: 'Changed@456' } });
  check('password reset: old password rejected', (await api('POST', '/api/auth/login', { body: { email, password: 'Secret@123' } })).status === 401);
  check('password reset: new password works', (await api('POST', '/api/auth/login', { body: { email, password: 'Changed@456' } })).status === 200);

  check('status needs a boolean -> 400', (await api('PATCH', `${url}/${id}/status`, { token: t.superadmin, body: { is_active: 'no' } })).status === 400);
  const off = await api('PATCH', `${url}/${id}/status`, { token: t.superadmin, body: { is_active: false } });
  check('disable admin', off.status === 200 && off.data.is_active === 0);
  check('disabled admin cannot log in -> 403', (await api('POST', '/api/auth/login', { body: { email, password: 'Changed@456' } })).status === 403);
  check('disabled admin existing token stops working -> 403', (await api('GET', '/api/auth/me', { token: adminToken })).status === 403);
  check('status=DISABLED filter', (await api('GET', `${url}?status=DISABLED`, { token: t.superadmin })).data.some((a) => a.id === id));
  const on = await api('PATCH', `${url}/${id}/status`, { token: t.superadmin, body: { is_active: true } });
  check('re-enable admin', on.status === 200 && on.data.is_active === 1);

  await pool.execute("INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, 'TEST', 'users', ?, 'history')", [id, id]);
  const blocked = await api('DELETE', `${url}/${id}`, { token: t.superadmin });
  check('admin with activity cannot be deleted -> 409', blocked.status === 409, blocked.body);
  await pool.execute('DELETE FROM audit_logs WHERE user_id = ?', [id]);
  const deleted = await api('DELETE', `${url}/${id}`, { token: t.superadmin });
  check('admin without activity can be deleted', deleted.status === 200, deleted.body);
  check('deleted admin is gone -> 404', (await api('GET', `${url}/${id}`, { token: t.superadmin })).status === 404);
});

// SECTIONS-END (new sections are added above this line)

async function main() {
  const filter = process.argv[2];
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Server not reachable at ${BASE}. Start it first (npm start).`);
    process.exit(2);
  }
  const [[{ lastLogId }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS lastLogId FROM audit_logs');
  const t = await tokens();
  for (const { name, fn } of sections) {
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;
    console.log(`\n${name}`);
    try {
      await fn(t);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL section crashed: ${err.stack || err.message}`);
    }
  }
  for (const fn of cleanups.reverse()) {
    try { await fn(); } catch (err) { console.log(`  cleanup warning: ${err.message}`); }
  }
  // Remove the audit entries this run created (test actions should not clutter the real log)
  await pool.execute('DELETE FROM audit_logs WHERE id > ?', [lastLogId]);
  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main();
