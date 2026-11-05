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
async function makeBooking(t, { pay = false, guests = 1, packageId = 1, earliest = false } = {}) {
  const deps = await api('GET', `/api/packages/${packageId}/departures`);
  const departure = earliest ? deps.data[0] : deps.data[deps.data.length - 1];
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

section('Admin permissions', async (t) => {
  const url = '/api/superadmin/admins';
  const list = await api('GET', '/api/superadmin/permissions', { token: t.superadmin });
  const names = list.data.map((x) => x.name);
  check('permission list', list.status === 200 && names.length === 6 && names.includes('MODERATE_PACKAGES') && list.data.every((x) => x.description));
  check('admin cannot read the permission list -> 403', (await api('GET', '/api/superadmin/permissions', { token: t.admin })).status === 403);

  const me = await api('GET', '/api/auth/me', { token: t.admin });
  check('demo admin has every permission in /api/auth/me', me.status === 200 && me.data.permissions.length === 6, me.body);
  const meSuper = await api('GET', '/api/auth/me', { token: t.superadmin });
  check('super admin /me lists every permission', meSuper.data.permissions.length === 6);
  check('customer /me has no permissions field', (await api('GET', '/api/auth/me', { token: t.customer })).data.permissions === undefined);

  const email = `perm.admin.${RUN}@example.com`;
  const pw = 'Secret@123';
  const bad = await api('POST', url, { token: t.superadmin, body: { full_name: 'P', email, password: pw, permissions: ['NOPE'] } });
  check('create with unknown permission -> 400', bad.status === 400);
  check('create with non-array permissions -> 400', (await api('POST', url, { token: t.superadmin, body: { full_name: 'P', email, password: pw, permissions: 'MANAGE_CUSTOMERS' } })).status === 400);

  const created = await api('POST', url, { token: t.superadmin, body: { full_name: 'Perm Admin', email, password: pw, permissions: ['MANAGE_CUSTOMERS', 'MANAGE_CUSTOMERS'] } });
  check('create with permissions (duplicates removed)', created.status === 201 && JSON.stringify(created.data.permissions) === '["MANAGE_CUSTOMERS"]', created.body);
  const id = created.data.id;
  cleanups.push(async () => {
    await pool.execute('DELETE FROM audit_logs WHERE user_id = ?', [id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  });
  const token = await login(email, pw);

  const meNew = await api('GET', '/api/auth/me', { token });
  check('new admin /me shows its permissions', JSON.stringify(meNew.data.permissions) === '["MANAGE_CUSTOMERS"]');
  check('allowed: customers', (await api('GET', '/api/admin/customers', { token })).status === 200);
  check('allowed: dashboard needs no permission', (await api('GET', '/api/admin/dashboard', { token })).status === 200);
  for (const [path, perm] of [['providers', 'MANAGE_PROVIDERS'], ['packages', 'MODERATE_PACKAGES'], ['destinations', 'MANAGE_CATALOGUE'], ['categories', 'MANAGE_CATALOGUE'], ['bookings', 'VIEW_BOOKINGS'], ['reports', 'VIEW_REPORTS']]) {
    const res = await api('GET', `/api/admin/${path}`, { token });
    check(`denied without ${perm}: GET /${path} -> 403`, res.status === 403, res.body);
  }
  check('denied: writing a category -> 403', (await api('POST', '/api/admin/categories', { token, body: { name: `X${RUN}`, description: '' } })).status === 403);
  check('denied: moderating a package -> 403', (await api('PATCH', '/api/admin/packages/1/status', { token, body: { status: 'APPROVED' } })).status === 403);
  check('denied: provider status -> 403', (await api('PATCH', '/api/admin/providers/2/status', { token, body: { is_active: true } })).status === 403);
  check('permissions do not open super admin routes -> 403', (await api('GET', url, { token })).status === 403);

  const got = await api('GET', `${url}/${id}/permissions`, { token: t.superadmin });
  check('read permissions', got.status === 200 && got.data.permissions.length === 1);
  check('read permissions bad id -> 400', (await api('GET', `${url}/x/permissions`, { token: t.superadmin })).status === 400);
  check('read permissions of a non-admin -> 404', (await api('GET', `${url}/1/permissions`, { token: t.superadmin })).status === 404);
  check('replace: unknown name -> 400', (await api('PUT', `${url}/${id}/permissions`, { token: t.superadmin, body: { permissions: ['MANAGE_CUSTOMERS', 'NOPE'] } })).status === 400);
  check('replace: not an array -> 400', (await api('PUT', `${url}/${id}/permissions`, { token: t.superadmin, body: { permissions: 5 } })).status === 400);
  check('replace: missing body field -> 400', (await api('PUT', `${url}/${id}/permissions`, { token: t.superadmin, body: {} })).status === 400);
  check('replace: non-admin -> 404', (await api('PUT', `${url}/1/permissions`, { token: t.superadmin, body: { permissions: [] } })).status === 404);
  check('admin cannot change permissions -> 403', (await api('PUT', `${url}/${id}/permissions`, { token: t.admin, body: { permissions: names } })).status === 403);
  check('admin cannot change own permissions -> 403', (await api('PUT', `${url}/3/permissions`, { token: t.admin, body: { permissions: [] } })).status === 403);

  const put = await api('PUT', `${url}/${id}/permissions`, { token: t.superadmin, body: { permissions: ['MODERATE_PACKAGES', 'VIEW_REPORTS'] } });
  check('replace permissions', put.status === 200 && JSON.stringify(put.data.permissions) === '["MODERATE_PACKAGES","VIEW_REPORTS"]', put.body);
  check('change takes effect immediately: packages now 200', (await api('GET', '/api/admin/packages', { token })).status === 200);
  check('change takes effect immediately: reports now 200', (await api('GET', '/api/admin/reports', { token })).status === 200);
  check('revoked permission: customers now 403', (await api('GET', '/api/admin/customers', { token })).status === 403);
  check('list shows permission_count', (await api('GET', `${url}/${id}`, { token: t.superadmin })).data.permission_count === 2);

  const none = await api('PUT', `${url}/${id}/permissions`, { token: t.superadmin, body: { permissions: [] } });
  check('empty array revokes everything', none.status === 200 && none.data.permissions.length === 0);
  check('no permissions: packages 403', (await api('GET', '/api/admin/packages', { token })).status === 403);

  const bare = await api('POST', url, { token: t.superadmin, body: { full_name: 'Bare', email: `bare.${RUN}@example.com`, password: pw } });
  cleanups.push(async () => {
    await pool.execute('DELETE FROM audit_logs WHERE user_id = ?', [bare.data.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [bare.data.id]);
  });
  check('admin created without permissions starts with none (least privilege)', bare.status === 201 && bare.data.permissions.length === 0);

  check('super admin passes every permission check', (await Promise.all(['customers', 'providers', 'packages', 'destinations', 'categories', 'bookings', 'reports'].map((x) => api('GET', `/api/admin/${x}`, { token: t.superadmin })))).every((r) => r.status === 200));
});

section('Super admin: logs viewer', async (t) => {
  const url = '/api/superadmin/logs';
  check('no token -> 401', (await api('GET', url)).status === 401);
  check('customer -> 403', (await api('GET', url, { token: t.customer })).status === 403);
  check('provider -> 403', (await api('GET', url, { token: t.provider })).status === 403);
  check('admin -> 403', (await api('GET', url, { token: t.admin })).status === 403);

  // Produce known log entries: one by the super admin, one by the demo admin
  const name = `LogTest ${RUN}`;
  const made = await api('POST', '/api/admin/categories', { token: t.superadmin, body: { name, description: 'log test' } });
  cleanups.push(() => pool.execute('DELETE FROM categories WHERE id = ?', [made.data.id]));
  await api('PUT', `/api/admin/categories/${made.data.id}`, { token: t.admin, body: { name, description: 'edited' } });

  const logs = await api('GET', `${url}?search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('logs list (paginated envelope by default)', logs.status === 200 && Array.isArray(logs.data.items) && logs.data.limit === 20 && logs.data.total === 2, logs.body);
  const [newest, oldest] = logs.data.items;
  check('newest first', newest.action === 'CATEGORY_UPDATED' && oldest.action === 'CATEGORY_CREATED');
  check('entry has actor, role, entity and details', oldest.user_email === 'superadmin@example.com' && oldest.user_role === 'SUPER_ADMIN' && oldest.entity === 'categories' && oldest.entity_id === made.data.id && oldest.details === name && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(oldest.created_at), oldest);
  check('updated entry was written by the admin', newest.user_email === 'admin@example.com');

  const byAction = await api('GET', `${url}?action=category_created&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('action filter (case-insensitive)', byAction.data.total === 1 && byAction.data.items[0].action === 'CATEGORY_CREATED');
  const byUser = await api('GET', `${url}?user_id=${newest.user_id}&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('user_id filter', byUser.data.total === 1 && byUser.data.items[0].user_email === 'admin@example.com');
  const byEntity = await api('GET', `${url}?entity=categories&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('entity filter', byEntity.data.total === 2);
  const none = await api('GET', `${url}?entity=destinations&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('entity filter excludes others', none.data.total === 0 && none.data.items.length === 0);
  const byActor = await api('GET', `${url}?search=admin@example.com&action=CATEGORY_UPDATED`, { token: t.superadmin });
  check('search matches actor email', byActor.data.items.some((x) => x.details === name));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  check('date range includes today', (await api('GET', `${url}?from=${today}&to=${today}&search=${encodeURIComponent(name)}`, { token: t.superadmin })).data.total === 2);
  check('future range is empty', (await api('GET', `${url}?from=2999-01-01`, { token: t.superadmin })).data.total === 0);

  const page1 = await api('GET', `${url}?limit=1&page=1&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  const page2 = await api('GET', `${url}?limit=1&page=2&search=${encodeURIComponent(name)}`, { token: t.superadmin });
  check('pagination pages differ', page1.data.items.length === 1 && page2.data.items.length === 1 && page1.data.items[0].id !== page2.data.items[0].id && page1.data.total_pages === 2);
  check('page past the end is empty', (await api('GET', `${url}?limit=1&page=9&search=${encodeURIComponent(name)}`, { token: t.superadmin })).data.items.length === 0);
  check('limit too large -> 400', (await api('GET', `${url}?limit=1000`, { token: t.superadmin })).status === 400);
  check('bad user_id -> 400', (await api('GET', `${url}?user_id=abc`, { token: t.superadmin })).status === 400);
  check('bad date -> 400', (await api('GET', `${url}?from=yesterday`, { token: t.superadmin })).status === 400);
  check('search is not an SQL hole', (await api('GET', `${url}?search=${encodeURIComponent("' OR 1=1 --")}`, { token: t.superadmin })).data.total === 0);
});

section('Super admin: settings', async (t) => {
  const url = '/api/superadmin/settings';
  check('no token -> 401', (await api('GET', url)).status === 401);
  check('admin -> 403 (list)', (await api('GET', url, { token: t.admin })).status === 403);
  check('admin -> 403 (update)', (await api('PUT', `${url}/maintenance_mode`, { token: t.admin, body: { value: 'true' } })).status === 403);
  check('customer -> 403', (await api('GET', url, { token: t.customer })).status === 403);

  const list = await api('GET', url, { token: t.superadmin });
  const original = Object.fromEntries(list.data.map((x) => [x.setting_key, x.setting_value]));
  check('list has the editable settings', list.status === 200 && 'maintenance_mode' in original && 'booking_cancellation_hours_limit' in original && list.data.every((x) => x.description));
  const restore = async () => {
    await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'maintenance_mode'", [original.maintenance_mode]);
    await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'booking_cancellation_hours_limit'", [original.booking_cancellation_hours_limit]);
  };
  cleanups.push(restore);

  check('unknown key -> 404', (await api('PUT', `${url}/nope`, { token: t.superadmin, body: { value: 'x' } })).status === 404);
  check('missing value -> 400', (await api('PUT', `${url}/maintenance_mode`, { token: t.superadmin, body: {} })).status === 400);
  check('maintenance_mode: invalid -> 400', (await api('PUT', `${url}/maintenance_mode`, { token: t.superadmin, body: { value: 'maybe' } })).status === 400);
  for (const bad of ['abc', '-1', '1.5', 721, '']) {
    check(`hours limit ${JSON.stringify(bad)} -> 400`, (await api('PUT', `${url}/booking_cancellation_hours_limit`, { token: t.superadmin, body: { value: bad } })).status === 400);
  }

  const set = await api('PUT', `${url}/booking_cancellation_hours_limit`, { token: t.superadmin, body: { value: 12 } });
  check('update hours limit (number accepted, stored as text)', set.status === 200 && set.data.setting_value === '12', set.body);
  check('boolean accepted for maintenance_mode', (await api('PUT', `${url}/maintenance_mode`, { token: t.superadmin, body: { value: false } })).data.setting_value === 'false');

  // The cancellation limit is really used by the booking flow
  await api('PUT', `${url}/booking_cancellation_hours_limit`, { token: t.superadmin, body: { value: 720 } });
  const tooLate = await makeBooking(t, { pay: true, earliest: true, packageId: 3 });
  const refused = await api('POST', `/api/bookings/${tooLate.id}/cancel`, { token: t.customer });
  check('limit of 720h blocks cancelling a departure ~3 weeks away', refused.status === 400 && /720 hours/.test(refused.error.message), refused.body);
  await api('PUT', `${url}/booking_cancellation_hours_limit`, { token: t.superadmin, body: { value: 24 } });
  const allowed = await api('POST', `/api/bookings/${tooLate.id}/cancel`, { token: t.customer });
  check('limit of 24h allows the same cancellation', allowed.status === 200, allowed.body);

  // maintenance mode is really enforced
  const on = await api('PUT', `${url}/maintenance_mode`, { token: t.superadmin, body: { value: 'true' } });
  check('enable maintenance mode', on.status === 200 && on.data.setting_value === 'true');
  try {
    check('public API -> 503', (await api('GET', '/api/packages')).status === 503);
    check('customer API -> 503', (await api('GET', '/api/bookings/my', { token: t.customer })).status === 503);
    check('provider API -> 503', (await api('GET', '/api/provider/dashboard', { token: t.provider })).status === 503);
    check('invalid token -> 503', (await api('GET', '/api/packages', { token: 'garbage' })).status === 503);
    check('health stays open', (await api('GET', '/api/health')).status === 200);
    check('login stays open', (await api('POST', '/api/auth/login', { body: { email: 'customer@example.com', password: PASSWORD } })).status === 200);
    check('admin keeps working', (await api('GET', '/api/admin/dashboard', { token: t.admin })).status === 200);
    check('super admin keeps working', (await api('GET', url, { token: t.superadmin })).status === 200);
    check('web pages stay available', (await fetch(`${BASE}/`)).status === 200);
  } finally {
    await api('PUT', `${url}/maintenance_mode`, { token: t.superadmin, body: { value: 'false' } });
  }
  check('maintenance off: public API works again', (await api('GET', '/api/packages')).status === 200);

  const logs = await api('GET', '/api/superadmin/logs?action=SETTING_UPDATED&limit=100', { token: t.superadmin });
  check('setting changes are logged with old and new value', logs.data.items.some((x) => x.details === 'maintenance_mode: false -> true'), logs.data.items.slice(0, 3));
});

section('Customer wishlist', async (t) => {
  const url = '/api/wishlist';
  check('no token -> 401', (await api('GET', url)).status === 401);
  for (const [who, token] of [['provider', t.provider], ['admin', t.admin], ['super admin', t.superadmin]]) {
    check(`${who} -> 403`, (await api('GET', url, { token })).status === 403);
  }
  check('provider cannot add -> 403', (await api('POST', url, { token: t.provider, body: { package_id: 1 } })).status === 403);

  // second customer for isolation checks
  const otherEmail = `wish.${RUN}@example.com`;
  const reg = await api('POST', '/api/auth/register', { body: { full_name: 'Wish Tester', email: otherEmail, password: 'Secret@123' } });
  cleanups.push(() => pool.execute('DELETE FROM users WHERE id = ?', [reg.data.id]));
  const other = await login(otherEmail, 'Secret@123');

  await pool.execute('DELETE FROM wishlists WHERE customer_id = 1');
  cleanups.push(() => pool.execute('DELETE FROM wishlists WHERE customer_id = 1'));
  const empty = await api('GET', url, { token: t.customer });
  check('starts empty', empty.status === 200 && empty.data.length === 0);

  for (const bad of [undefined, 0, -1, 'abc', 1.5]) {
    check(`package_id ${JSON.stringify(bad)} -> 400`, (await api('POST', url, { token: t.customer, body: { package_id: bad } })).status === 400);
  }
  check('unknown package -> 404', (await api('POST', url, { token: t.customer, body: { package_id: 99999999 } })).status === 404);

  const pending = await api('POST', '/api/provider/packages', {
    token: t.provider,
    body: { title: `Wish Test ${RUN}`, description: 'd', destination_id: 1, price: 50, duration_days: 1, image_url: '/assets/img/cities.jpg' },
  });
  const pid = pending.data.id;
  cleanups.push(() => pool.execute('DELETE FROM packages WHERE id = ?', [pid]));
  check('PENDING package cannot be saved -> 404', (await api('POST', url, { token: t.customer, body: { package_id: pid } })).status === 404);

  const first = await api('POST', url, { token: t.customer, body: { package_id: 1 } });
  check('add -> 201', first.status === 201 && first.data.wishlisted === true, first.body);
  const again = await api('POST', url, { token: t.customer, body: { package_id: 1 } });
  check('add again is a no-op -> 200', again.status === 200);
  await api('POST', url, { token: t.customer, body: { package_id: 2 } });

  const list = await api('GET', url, { token: t.customer });
  check('list has each package once, newest first', list.data.length === 2 && list.data[0].package_id === 2 && list.data[1].package_id === 1, list.body);
  const item = list.data[1];
  check('item has card fields', item.title && item.price && item.duration_days && item.image_url && item.destination_name && item.added_at && 'category_name' in item, item);

  check('other customer has their own empty list', (await api('GET', url, { token: other })).data.length === 0);
  const foreign = await api('DELETE', `${url}/1`, { token: other });
  check("other customer's delete does not touch mine", foreign.status === 200 && foreign.data.removed === false && (await api('GET', url, { token: t.customer })).data.length === 2);

  // package visibility follows moderation
  await api('PATCH', `/api/admin/packages/${pid}/status`, { token: t.admin, body: { status: 'APPROVED' } });
  await api('POST', url, { token: t.customer, body: { package_id: pid } });
  check('approved package can be saved', (await api('GET', url, { token: t.customer })).data.some((x) => x.package_id === pid));
  await api('PATCH', `/api/admin/packages/${pid}/status`, { token: t.admin, body: { status: 'REJECTED' } });
  check('rejected package disappears from the list', !(await api('GET', url, { token: t.customer })).data.some((x) => x.package_id === pid));
  await api('PATCH', `/api/admin/packages/${pid}/status`, { token: t.admin, body: { status: 'APPROVED' } });
  check('and returns when approved again', (await api('GET', url, { token: t.customer })).data.some((x) => x.package_id === pid));

  check('remove bad id -> 400', (await api('DELETE', `${url}/abc`, { token: t.customer })).status === 400);
  const del = await api('DELETE', `${url}/1`, { token: t.customer });
  check('remove', del.status === 200 && del.data.removed === true && del.data.wishlisted === false);
  const delAgain = await api('DELETE', `${url}/1`, { token: t.customer });
  check('remove again is a no-op -> 200', delAgain.status === 200 && delAgain.data.removed === false);
  check('list no longer has it', !(await api('GET', url, { token: t.customer })).data.some((x) => x.package_id === 1));
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
