const { ok, fail } = require('../utils/response');
const { getProviderDashboard } = require('../services/providerService');

async function getDashboard(req, res) {
  try {
    const dashboard = await getProviderDashboard(req.user.id);
    if (!dashboard) return fail(res, 404, 'Provider account not found');
    return ok(res, dashboard);
  } catch (err) {
    console.error('Provider dashboard error:', err);
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load provider dashboard');
  }
}

module.exports = { getDashboard };
