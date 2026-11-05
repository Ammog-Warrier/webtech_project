const { pool } = require('../config/db');
const { PERMISSION_NAMES } = require('../utils/permissions');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function getAdminPermissions(adminId) {
  const [rows] = await pool.execute(
    'SELECT permission FROM admin_permissions WHERE admin_id = ? ORDER BY permission',
    [adminId]
  );
  // Ignore stale names that are no longer in the permission list
  return rows.map((row) => row.permission).filter((name) => PERMISSION_NAMES.includes(name));
}

async function hasPermission(user, permission) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role !== 'ADMIN') return false;
  const [rows] = await pool.execute(
    'SELECT 1 FROM admin_permissions WHERE admin_id = ? AND permission = ? LIMIT 1',
    [user.id, permission]
  );
  return rows.length > 0;
}

// Effective permissions of the logged-in user (super admins have all of them).
async function getUserPermissions(user) {
  if (user.role === 'SUPER_ADMIN') return [...PERMISSION_NAMES];
  if (user.role === 'ADMIN') return getAdminPermissions(user.id);
  return [];
}

// Replaces the full permission set of an admin. Validates names and removes duplicates.
async function setAdminPermissions(adminId, permissions) {
  if (!Array.isArray(permissions)) throw httpError(400, 'permissions must be an array');
  const unique = [...new Set(permissions)];
  const unknown = unique.filter((name) => !PERMISSION_NAMES.includes(name));
  if (unknown.length) throw httpError(400, `Unknown permission: ${unknown.map(String).join(', ')}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
    for (const name of unique) {
      await conn.execute('INSERT INTO admin_permissions (admin_id, permission) VALUES (?, ?)', [adminId, name]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getAdminPermissions(adminId);
}

module.exports = { getAdminPermissions, hasPermission, getUserPermissions, setAdminPermissions };
