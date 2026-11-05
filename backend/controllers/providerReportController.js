const { ok } = require('../utils/response');
const { getProviderReports } = require('../services/providerReportService');

async function getMyReports(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const report = await getProviderReports(
    req.user.id,
    url.searchParams.get('from'),
    url.searchParams.get('to')
  );
  ok(res, report);
}

module.exports = { getMyReports };
