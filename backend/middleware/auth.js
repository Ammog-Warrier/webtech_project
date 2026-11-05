const { verifyToken } = require('../utils/token');
const { fail } = require('../utils/response');
const { getUserById } = require('../services/authService');
const { hasPermission } = require('../services/permissionService');

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

// Use this wrapper for provider operations that require an approved provider account.
// The provider dashboard itself intentionally remains accessible while approval is pending.
function requireApprovedProvider(handler) {
  return requireRole('PROVIDER', async function (req, res) {
    if (req.user.provider_status !== 'APPROVED') {
      const status = req.user.provider_status || 'PENDING';
      return fail(res, 403, `Provider approval required. Current status: ${status}`);
    }
    return await handler(req, res);
  });
}

// ADMIN accounts need the named permission (granted by a super admin); SUPER_ADMIN always passes.
function requirePermission(permission, handler) {
  return requireRole(['ADMIN', 'SUPER_ADMIN'], async function (req, res) {
    if (!(await hasPermission(req.user, permission))) {
      return fail(res, 403, 'You do not have permission to perform this action');
    }
    return await handler(req, res);
  });
}

module.exports = { requireAuth, requireRole, requireApprovedProvider, requirePermission };
