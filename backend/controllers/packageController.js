const { ok, fail } = require('../utils/response');
const { listPackages } = require('../services/packageService');

async function getPackages(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const raw = searchParams.get('destination_id');
  const destinationId = raw === null ? null : Number(raw);
  if (raw !== null && !Number.isInteger(destinationId)) {
    return fail(res, 400, 'destination_id must be an integer');
  }
  ok(res, await listPackages(destinationId));
}

module.exports = { getPackages };
