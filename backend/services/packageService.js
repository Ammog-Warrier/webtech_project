const { pool } = require('../config/db');

// Only APPROVED packages are public. Optional filter: destinationId (number). Returns packages with their destination name.
async function listPackages(destinationId) {
  let sql = `SELECT p.id, p.title, p.description, p.price, p.duration_days, p.image_url,
                    p.destination_id, d.name AS destination_name
             FROM packages p JOIN destinations d ON d.id = p.destination_id
             WHERE p.status = 'APPROVED'`;
  const params = [];
  if (destinationId) {
    sql += ' AND p.destination_id = ?';
    params.push(destinationId);
  }
  sql += ' ORDER BY p.title';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Single package with detail fields; itinerary and inclusions are returned as arrays of lines.
async function findPackage(id) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.title, p.description, p.itinerary, p.inclusions, p.price, p.duration_days,
            p.max_group_size, p.image_url, p.destination_id, d.name AS destination_name
     FROM packages p JOIN destinations d ON d.id = p.destination_id
     WHERE p.id = ? AND p.status = 'APPROVED'`,
    [id]
  );
  if (!rows.length) return null;
  const toLines = (text) => (text ? text.split('\n').filter(Boolean) : []);
  const pkg = rows[0];
  return { ...pkg, itinerary: toLines(pkg.itinerary), inclusions: toLines(pkg.inclusions) };
}

module.exports = { listPackages, findPackage };
