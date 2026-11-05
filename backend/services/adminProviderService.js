const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function getProvider(providerId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.provider_status,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at,
            (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id) AS package_count,
            (SELECT COUNT(*)
               FROM bookings b
               JOIN package_departures pd ON pd.id = b.departure_id
               JOIN packages p ON p.id = pd.package_id
              WHERE p.provider_id = u.id) AS booking_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name = 'PROVIDER'
      LIMIT 1`,
    [providerId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...row,
    is_active: Number(row.is_active),
    package_count: Number(row.package_count),
    booking_count: Number(row.booking_count),
  };
}

async function listProviders({ search = '', status = '' } = {}) {
  const conditions = ["r.name = 'PROVIDER'"];
  const params = [];
  const cleanSearch = String(search).trim();
  const cleanStatus = String(status).toUpperCase();

  if (cleanSearch) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term);
  }
  if (cleanStatus === 'PENDING') conditions.push("u.provider_status = 'PENDING'");
  else if (cleanStatus === 'APPROVED') conditions.push("u.provider_status = 'APPROVED' AND u.is_active = 1");
  else if (cleanStatus === 'REJECTED') conditions.push("u.provider_status = 'REJECTED'");
  else if (cleanStatus === 'BLOCKED') conditions.push('u.is_active = 0');

  const [rows] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.provider_status,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at,
            (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id) AS package_count,
            (SELECT COUNT(*)
               FROM bookings b
               JOIN package_departures pd ON pd.id = b.departure_id
               JOIN packages p ON p.id = pd.package_id
              WHERE p.provider_id = u.id) AS booking_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY CASE u.provider_status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
               u.created_at DESC, u.id DESC`,
    params
  );
  return rows.map((row) => ({
    ...row,
    is_active: Number(row.is_active),
    package_count: Number(row.package_count),
    booking_count: Number(row.booking_count),
  }));
}

async function updateProvider(providerId, changes) {
  const current = await getProvider(providerId);
  if (!current) throw httpError(404, 'Provider not found');

  if (changes.provider_status) {
    await pool.execute(
      `UPDATE users u
         JOIN roles r ON r.id = u.role_id
          SET u.provider_status = ?
        WHERE u.id = ? AND r.name = 'PROVIDER'`,
      [changes.provider_status, providerId]
    );
  } else if (typeof changes.is_active === 'boolean') {
    await pool.execute(
      `UPDATE users u
         JOIN roles r ON r.id = u.role_id
          SET u.is_active = ?
        WHERE u.id = ? AND r.name = 'PROVIDER'`,
      [changes.is_active ? 1 : 0, providerId]
    );
  }
  return getProvider(providerId);
}

module.exports = { listProviders, getProvider, updateProvider };
