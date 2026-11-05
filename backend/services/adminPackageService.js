const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'];

const SELECT_FIELDS = `p.id, p.title, p.description, p.itinerary, p.inclusions, p.price,
       p.duration_days, p.max_group_size, p.image_url, p.status, p.rejection_reason,
       p.destination_id, d.name AS destination_name,
       p.category_id, c.name AS category_name,
       p.provider_id, u.full_name AS provider_name, u.email AS provider_email,
       DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at,
       (SELECT COUNT(*) FROM package_departures pd WHERE pd.package_id = p.id) AS departure_count`;

const FROM = `FROM packages p
       JOIN destinations d ON d.id = p.destination_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.provider_id`;

function clean(row) {
  return { ...row, departure_count: Number(row.departure_count) };
}

async function listPackages({ search = '', status = '' } = {}) {
  const conditions = ['1 = 1'];
  const params = [];
  const cleanSearch = String(search).trim();
  const cleanStatus = String(status).toUpperCase();

  if (cleanStatus) {
    if (!STATUSES.includes(cleanStatus)) throw httpError(400, 'Invalid status filter');
    conditions.push('p.status = ?');
    params.push(cleanStatus);
  }
  if (cleanSearch) {
    conditions.push('(p.title LIKE ? OR d.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term, term);
  }

  const [rows] = await pool.execute(
    `SELECT ${SELECT_FIELDS}
       ${FROM}
      WHERE ${conditions.join(' AND ')}
      ORDER BY CASE p.status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 WHEN 'REJECTED' THEN 2 ELSE 3 END,
               p.created_at DESC, p.id DESC`,
    params
  );
  return rows.map(clean);
}

async function getPackage(packageId) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_FIELDS} ${FROM} WHERE p.id = ? LIMIT 1`,
    [packageId]
  );
  return rows.length ? clean(rows[0]) : null;
}

// Approves or rejects a package. ARCHIVED packages cannot be moderated.
async function moderatePackage(packageId, status, reason) {
  const current = await getPackage(packageId);
  if (!current) throw httpError(404, 'Package not found');
  if (current.status === 'ARCHIVED') throw httpError(409, 'Archived packages cannot be moderated');

  await pool.execute(
    'UPDATE packages SET status = ?, rejection_reason = ? WHERE id = ?',
    [status, status === 'REJECTED' ? (reason || null) : null, packageId]
  );
  return getPackage(packageId);
}

module.exports = { listPackages, getPackage, moderatePackage };
