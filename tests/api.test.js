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

// SECTIONS-END (new sections are added above this line)

async function main() {
  const filter = process.argv[2];
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Server not reachable at ${BASE}. Start it first (npm start).`);
    process.exit(2);
  }
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
  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main();
