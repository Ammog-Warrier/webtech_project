const { pool } = require('../config/db');

// Reads audit_logs with filters; paginated in SQL because the log keeps growing.
async function listLogs({ userId = null, action = '', entity = '', search = '', from = null, to = null, page, limit }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (userId) {
    conditions.push('l.user_id = ?');
    params.push(userId);
  }
  if (action) {
    conditions.push('l.action = ?');
    params.push(String(action).toUpperCase());
  }
  if (entity) {
    conditions.push('l.entity = ?');
    params.push(String(entity).toLowerCase());
  }
  if (search) {
    conditions.push('(l.details LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (from) {
    conditions.push('DATE(l.created_at) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('DATE(l.created_at) <= ?');
    params.push(to);
  }

  const where = conditions.join(' AND ');
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM audit_logs l JOIN users u ON u.id = l.user_id WHERE ${where}`,
    params
  );
  const [rows] = await pool.execute(
    `SELECT l.id, l.user_id, u.full_name AS user_name, u.email AS user_email, r.name AS user_role,
            l.action, l.entity, l.entity_id, l.details,
            DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM audit_logs l
       JOIN users u ON u.id = l.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE ${where}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?`,
    [...params, String(limit), String((page - 1) * limit)]
  );
  return {
    items: rows,
    page,
    limit,
    total: Number(total),
    total_pages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}

module.exports = { listLogs };
