const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function listAdminDestinations(search = '') {
  const term = String(search).trim();
  const params = [];
  let where = '';
  if (term) {
    where = 'WHERE d.name LIKE ? OR d.description LIKE ?';
    params.push(`%${term}%`, `%${term}%`);
  }

  const [rows] = await pool.execute(
    `SELECT d.id, d.name, d.description, d.image_url,
            DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') AS created_at,
            COUNT(DISTINCT p.id) AS package_count
       FROM destinations d
       LEFT JOIN packages p ON p.destination_id = d.id
       ${where}
      GROUP BY d.id, d.name, d.description, d.image_url, d.created_at
      ORDER BY d.name, d.id`,
    params
  );
  return rows.map((row) => ({ ...row, package_count: Number(row.package_count) }));
}

async function getAdminDestination(destinationId) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.name, d.description, d.image_url,
            DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') AS created_at,
            COUNT(DISTINCT p.id) AS package_count
       FROM destinations d
       LEFT JOIN packages p ON p.destination_id = d.id
      WHERE d.id = ?
      GROUP BY d.id, d.name, d.description, d.image_url, d.created_at
      LIMIT 1`,
    [destinationId]
  );
  if (!rows.length) return null;
  return { ...rows[0], package_count: Number(rows[0].package_count) };
}

async function createAdminDestinationRecord(destination) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO destinations (name, description, image_url) VALUES (?, ?, ?)',
      [destination.name, destination.description, destination.image_url]
    );
    return getAdminDestination(result.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'A destination with this name already exists');
    throw err;
  }
}

async function updateAdminDestinationRecord(destinationId, destination) {
  const existing = await getAdminDestination(destinationId);
  if (!existing) throw httpError(404, 'Destination not found');

  try {
    await pool.execute(
      'UPDATE destinations SET name = ?, description = ?, image_url = ? WHERE id = ?',
      [destination.name, destination.description, destination.image_url, destinationId]
    );
    return getAdminDestination(destinationId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'A destination with this name already exists');
    throw err;
  }
}

async function deleteAdminDestinationRecord(destinationId) {
  const existing = await getAdminDestination(destinationId);
  if (!existing) throw httpError(404, 'Destination not found');
  if (existing.package_count > 0) {
    throw httpError(409, 'This destination has packages linked to it and cannot be deleted');
  }

  try {
    await pool.execute('DELETE FROM destinations WHERE id = ?', [destinationId]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw httpError(409, 'This destination is referenced by other records and cannot be deleted');
    }
    throw err;
  }
  return true;
}

module.exports = {
  listAdminDestinations,
  getAdminDestination,
  createAdminDestinationRecord,
  updateAdminDestinationRecord,
  deleteAdminDestinationRecord,
};
