const { ok, fail } = require('../utils/response');
const { listPackages, findPackage } = require('../services/packageService');

async function getPackages(req, res) {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const raw = searchParams.get('destination_id');
  const destinationId = raw === null ? null : Number(raw);
  if (raw !== null && !Number.isInteger(destinationId)) {
    return fail(res, 400, 'destination_id must be an integer');
  }
  ok(res, await listPackages(destinationId));
}

async function getPackage(req, res) {
  if (!/^\d+$/.test(req.params.id)) return fail(res, 400, 'id must be an integer');
  const pkg = await findPackage(Number(req.params.id));
  if (!pkg) return fail(res, 404, 'Package not found');
  ok(res, pkg);
}

module.exports = { getPackages, getPackage };
