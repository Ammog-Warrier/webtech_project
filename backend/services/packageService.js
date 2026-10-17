const { pool } = require('../config/db');

// Optional filter: destinationId (number). Returns packages with their destination name.
async function listPackages(destinationId) {
  let sql = `SELECT p.id, p.title, p.description, p.price, p.duration_days, p.image_url,
                    p.destination_id, d.name AS destination_name
             FROM packages p JOIN destinations d ON d.id = p.destination_id`;
  const params = [];
  if (destinationId) {
    sql += ' WHERE p.destination_id = ?';
    params.push(destinationId);
  }
  sql += ' ORDER BY p.title';
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { listPackages };
