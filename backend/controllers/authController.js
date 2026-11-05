const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { registerUser, loginUser } = require('../services/authService');
const { getUserPermissions } = require('../services/permissionService');
const { isLocked, recordFailure, clearFailures } = require('../utils/rateLimit');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isText = (value) => typeof value === 'string';

async function register(req, res) {
  const body = await parseJsonBody(req);
  const fullName = isText(body.full_name) ? body.full_name.trim() : '';
  const email = isText(body.email) ? body.email.trim().toLowerCase() : '';
  const phone = isText(body.phone) && body.phone.trim() ? body.phone.trim() : null;
  const role = body.role === undefined ? 'CUSTOMER' : body.role;

  if (!fullName || fullName.length > 100) return fail(res, 400, 'Full name is required (max 100 characters)');
  if (!EMAIL_PATTERN.test(email) || email.length > 150) return fail(res, 400, 'A valid email is required');
  if (phone && !/^[0-9+()\- ]{6,20}$/.test(phone)) return fail(res, 400, 'Phone number is not valid');
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently cut.
  if (!isText(body.password) || body.password.length < 8 || Buffer.byteLength(body.password) > 72) {
    return fail(res, 400, 'Password must be 8 to 72 characters');
  }
  if (role !== 'CUSTOMER' && role !== 'PROVIDER') return fail(res, 400, 'Role must be CUSTOMER or PROVIDER');

  ok(res, await registerUser({ fullName, email, phone, password: body.password, role }), 201);
}

async function login(req, res) {
  const body = await parseJsonBody(req);
  const email = isText(body.email) ? body.email.trim().toLowerCase() : '';
  if (!email || !isText(body.password) || !body.password) {
    return fail(res, 400, 'Email and password are required');
  }
  const key = `${req.socket.remoteAddress}|${email}`;
  if (isLocked(key)) return fail(res, 429, 'Too many failed login attempts. Please try again in a few minutes.');
  try {
    const result = await loginUser(email, body.password);
    clearFailures(key);
    ok(res, result);
  } catch (err) {
    if (err.status === 401) recordFailure(key);
    throw err;
  }
}

// For ADMIN and SUPER_ADMIN the response also lists the effective permissions so the UI can hide pages.
async function getMe(req, res) {
  if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
    return ok(res, { ...req.user, permissions: await getUserPermissions(req.user) });
  }
  ok(res, req.user);
}

module.exports = { register, login, getMe };
