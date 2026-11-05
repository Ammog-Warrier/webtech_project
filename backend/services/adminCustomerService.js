const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function listCustomers({ search = '', status = '' } = {}) {
  const conditions = ["r.name = 'CUSTOMER'"];
  const params = [];
  const cleanSearch = String(search).trim();
  const cleanStatus = String(status).toUpperCase();

  if (cleanSearch) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term);
  }
  if (cleanStatus === 'ACTIVE') conditions.push('u.is_active = 1');
  if (cleanStatus === 'BLOCKED') conditions.push('u.is_active = 0');

  const [rows] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at,
            COUNT(DISTINCT b.id) AS booking_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN bookings b ON b.customer_id = u.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at
      ORDER BY u.created_at DESC, u.id DESC`,
    params
  );
  return rows;
}

async function getCustomer(customerId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at,
            COUNT(DISTINCT b.id) AS booking_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN bookings b ON b.customer_id = u.id
      WHERE u.id = ? AND r.name = 'CUSTOMER'
      GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at
      LIMIT 1`,
    [customerId]
  );
  return rows[0] || null;
}

async function setCustomerActiveStatus(customerId, isActive) {
  if (typeof isActive !== 'boolean') throw httpError(400, 'is_active must be a boolean');
  const [result] = await pool.execute(
    `UPDATE users u
       JOIN roles r ON r.id = u.role_id
        SET u.is_active = ?
      WHERE u.id = ? AND r.name = 'CUSTOMER'`,
    [isActive ? 1 : 0, customerId]
  );
  if (!result.affectedRows) {
    const existing = await getCustomer(customerId);
    if (!existing) throw httpError(404, 'Customer not found');
  }
  return getCustomer(customerId);
}

module.exports = { listCustomers, getCustomer, setCustomerActiveStatus };
