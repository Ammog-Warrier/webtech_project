const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { parsePaging, applyPaging } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const {
  listPackages,
  getPackage,
  moderatePackage,
} = require('../services/adminPackageService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getPackages(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const paging = parsePaging(url.searchParams);
    const packages = await listPackages({
      search: url.searchParams.get('search') || '',
      status: url.searchParams.get('status') || '',
    });
    return ok(res, applyPaging(packages, paging));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load packages');
  }
}

async function getPackageDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Package id must be a positive integer');
  try {
    const pkg = await getPackage(Number(req.params.id));
    if (!pkg) return fail(res, 404, 'Package not found');
    return ok(res, pkg);
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load package');
  }
}

async function updatePackageStatus(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Package id must be a positive integer');
  const body = await parseJsonBody(req);
  if (!body || !['APPROVED', 'REJECTED'].includes(body.status)) {
    return fail(res, 400, 'status must be APPROVED or REJECTED');
  }
  let reason = null;
  if (body.rejection_reason !== undefined && body.rejection_reason !== null) {
    if (typeof body.rejection_reason !== 'string') {
      return fail(res, 400, 'rejection_reason must be text');
    }
    reason = body.rejection_reason.trim();
    if (reason.length > 255) return fail(res, 400, 'rejection_reason must be 255 characters or fewer');
  }
  try {
    const pkg = await moderatePackage(Number(req.params.id), body.status, reason);
    await logAction(req.user.id, `PACKAGE_${body.status}`, 'packages', pkg.id, pkg.title);
    return ok(res, pkg);
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to update package');
  }
}

module.exports = { getPackages, getPackageDetails, updatePackageStatus };
