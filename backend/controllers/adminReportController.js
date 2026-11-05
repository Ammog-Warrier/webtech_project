const { ok, fail } = require('../utils/response');
const { parseDateRange } = require('../utils/dates');
const { getAdminReport } = require('../services/adminReportService');

async function getReport(req, res) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const range = parseDateRange(params.get('from'), params.get('to'));
    return ok(res, await getAdminReport(range));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to build report');
  }
}

module.exports = { getReport };
