const { ok, fail } = require('../utils/response');
const { listPackageDepartures } = require('../services/departureService');

async function getPackageDepartures(req, res) {
  const packageId = Number(req.params.id);
  if (!Number.isInteger(packageId) || packageId <= 0) {
    return fail(res, 400, 'id must be an integer');
  }

  try {
    const departures = await listPackageDepartures(packageId);
    ok(res, departures);
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

module.exports = { getPackageDepartures };

