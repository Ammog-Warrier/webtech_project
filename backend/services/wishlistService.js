const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Only APPROVED packages are shown; a package that was archived or rejected later stays saved but hidden.
async function listWishlist(customerId) {
  const [rows] = await pool.execute(
    `SELECT p.id AS package_id, p.title, p.price, p.duration_days, p.image_url,
            d.name AS destination_name, c.name AS category_name,
            DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i') AS added_at
       FROM wishlists w
       JOIN packages p ON p.id = w.package_id
       JOIN destinations d ON d.id = p.destination_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE w.customer_id = ? AND p.status = 'APPROVED'
      ORDER BY w.created_at DESC, w.id DESC`,
    [customerId]
  );
  return rows;
}

// Idempotent: saving a package twice is not an error. Returns { added } (false if it was already saved).
async function addToWishlist(customerId, packageId) {
  const [pkg] = await pool.execute(
    "SELECT id FROM packages WHERE id = ? AND status = 'APPROVED'",
    [packageId]
  );
  if (!pkg.length) throw httpError(404, 'Package not found');
  const [result] = await pool.execute(
    'INSERT IGNORE INTO wishlists (customer_id, package_id) VALUES (?, ?)',
    [customerId, packageId]
  );
  return { added: result.affectedRows > 0 };
}

// Idempotent: removing a package that is not saved is not an error. Returns { removed }.
async function removeFromWishlist(customerId, packageId) {
  const [result] = await pool.execute(
    'DELETE FROM wishlists WHERE customer_id = ? AND package_id = ?',
    [customerId, packageId]
  );
  return { removed: result.affectedRows > 0 };
}

module.exports = { listWishlist, addToWishlist, removeFromWishlist };
