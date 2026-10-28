const { verifyToken } = require('../utils/token');
const { fail } = require('../utils/response');
const { getUserById } = require('../services/authService');

function requireAuth(handler) {
  return async function (req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return fail(res, 401, 'Authentication token required');
    }
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (!payload || !payload.sub) {
      return fail(res, 401, 'Invalid or expired token');
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      return fail(res, 401, 'User not found');
    }
    if (!user.is_active) {
      return fail(res, 403, 'This account has been disabled');
    }

    req.user = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      provider_status: user.provider_status,
    };

    return await handler(req, res);
  };
}

function requireRole(allowedRoles, handler) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return requireAuth(async function (req, res) {
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'Insufficient permissions');
    }
    return await handler(req, res);
  });
}

module.exports = { requireAuth, requireRole };
