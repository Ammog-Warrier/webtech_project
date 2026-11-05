const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { getAdminPermissions, setAdminPermissions } = require('./permissionService');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Only ADMIN accounts are managed here; SUPER_ADMIN accounts can never be changed through these functions.
const ADMIN_SELECT = `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
       DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at,
       (SELECT COUNT(*) FROM admin_permissions ap WHERE ap.admin_id = u.id) AS permission_count
  FROM users u
  JOIN roles r ON r.id = u.role_id`;

function clean(row) {
  return { ...row, is_active: Number(row.is_active), permission_count: Number(row.permission_count) };
}

async function listAdmins({ search = '', status = '' } = {}) {
  const conditions = ["r.name = 'ADMIN'"];
  const params = [];
  const cleanSearch = String(search).trim();
  const cleanStatus = String(status).toUpperCase();

  if (cleanStatus) {
    if (!['ACTIVE', 'DISABLED'].includes(cleanStatus)) throw httpError(400, 'status must be ACTIVE or DISABLED');
    conditions.push('u.is_active = ?');
    params.push(cleanStatus === 'ACTIVE' ? 1 : 0);
  }
  if (cleanSearch) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term);
  }
  const [rows] = await pool.execute(
    `${ADMIN_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY u.created_at DESC, u.id DESC`,
    params
  );
  return rows.map(clean);
}

async function getAdmin(adminId) {
  const [rows] = await pool.execute(
    `${ADMIN_SELECT} WHERE u.id = ? AND r.name = 'ADMIN' LIMIT 1`,
    [adminId]
  );
  if (!rows.length) return null;
  return { ...clean(rows[0]), permissions: await getAdminPermissions(adminId) };
}

async function createAdmin({ fullName, email, phone, password, permissions = [] }) {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash, provider_status)
       SELECT id, ?, ?, ?, ?, 'NOT_APPLICABLE' FROM roles WHERE name = 'ADMIN'`,
      [fullName, email, phone, passwordHash]
    );
    if (permissions.length) await setAdminPermissions(result.insertId, permissions);
    return getAdmin(result.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'An account with this email already exists');
    throw err;
  }
}

// Updates name, email and phone; a new password is applied only when one is given.
async function updateAdmin(adminId, { fullName, email, phone, password }) {
  if (!(await getAdmin(adminId))) throw httpError(404, 'Admin not found');
  try {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, password_hash = ? WHERE id = ?',
        [fullName, email, phone, passwordHash, adminId]
      );
    } else {
      await pool.execute(
        'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
        [fullName, email, phone, adminId]
      );
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'An account with this email already exists');
    throw err;
  }
  return getAdmin(adminId);
}

async function setAdminActive(adminId, isActive) {
  if (!(await getAdmin(adminId))) throw httpError(404, 'Admin not found');
  await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, adminId]);
  return getAdmin(adminId);
}

// Admins who already have audit history cannot be deleted (their log entries must stay); disable them instead.
async function deleteAdmin(adminId) {
  const admin = await getAdmin(adminId);
  if (!admin) throw httpError(404, 'Admin not found');
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw httpError(409, 'This admin has recorded activity and cannot be deleted. Disable the account instead.');
    }
    throw err;
  }
  return admin;
}

module.exports = { listAdmins, getAdmin, createAdmin, updateAdmin, setAdminActive, deleteAdmin };
