const { ok, fail } = require('../utils/response');
const { getAdminDashboard } = require('../services/adminDashboardService');

async function getDashboard(req, res) {
  try {
    return ok(res, await getAdminDashboard());
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return fail(res, 500, 'Unable to load the admin dashboard');
  }
}

module.exports = { getDashboard };
