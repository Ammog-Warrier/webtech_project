const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { createToken } = require('../utils/token');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Hash of a throwaway password, compared against when the email is unknown so timing doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Public self-registration is limited to these roles; admins are created by a super admin.
const REGISTRABLE_ROLES = ['CUSTOMER', 'PROVIDER'];

// Never include password_hash in anything returned to clients.
const toPublicUser = (row) => ({
  id: row.id,
  full_name: row.full_name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  provider_status: row.provider_status,
});

const USER_SELECT = `SELECT u.id, u.full_name, u.email, u.phone, u.password_hash, u.is_active,
                            u.provider_status, r.name AS role
                     FROM users u JOIN roles r ON r.id = u.role_id`;

async function registerUser({ fullName, email, phone, password, role }) {
  if (!REGISTRABLE_ROLES.includes(role)) throw httpError(400, 'Invalid role');
  const passwordHash = await bcrypt.hash(password, 10);
  const providerStatus = role === 'PROVIDER' ? 'PENDING' : 'NOT_APPLICABLE';
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash, provider_status)
       SELECT id, ?, ?, ?, ?, ? FROM roles WHERE name = ?`,
      [fullName, email, phone, passwordHash, providerStatus, role]
    );
    const [rows] = await pool.execute(`${USER_SELECT} WHERE u.id = ?`, [result.insertId]);
    return toPublicUser(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'An account with this email already exists');
    throw err;
  }
}

async function loginUser(email, password) {
  const [rows] = await pool.execute(`${USER_SELECT} WHERE u.email = ?`, [email]);
  const user = rows[0];
  const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !matches) throw httpError(401, 'Invalid email or password');
  if (!user.is_active) throw httpError(403, 'This account has been disabled');
  return { token: createToken(user.id, user.role), user: toPublicUser(user) };
}

module.exports = { registerUser, loginUser };
