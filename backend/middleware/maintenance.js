const { verifyToken } = require('../utils/token');
const { isMaintenanceMode } = require('../services/settingsService');

// Paths that keep working in maintenance mode so admins can still sign in.
const ALWAYS_OPEN = ['/api/health', '/api/auth/login'];

// True when the request must be refused with 503: maintenance mode is on and the caller is not an
// admin or super admin (identified by the signed token; requireAuth still re-checks the account).
async function isBlockedByMaintenance(req, pathname) {
  if (ALWAYS_OPEN.includes(pathname)) return false;
  if (!(await isMaintenanceMode())) return false;
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    const payload = verifyToken(header.slice(7).trim());
    if (payload && (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN')) return false;
  }
  return true;
}

module.exports = { isBlockedByMaintenance };
