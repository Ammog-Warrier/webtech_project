const { ok, fail } = require('../utils/response');
const {
  listProviderPackages,
  listPackageFormOptions,
  createProviderPackage,
  updateProviderPackage,
  archiveProviderPackage,
} = require('../services/providerPackageService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getMyPackages(req, res) {
  ok(res, await listProviderPackages(req.user.id));
}

async function getPackageFormOptions(req, res) {
  ok(res, await listPackageFormOptions());
}

async function createPackage(req, res) {
  const { parseJsonBody } = require('../utils/body');
  const body = await parseJsonBody(req);
  const created = await createProviderPackage(req.user.id, body);
  ok(res, created, 201);
}

async function updatePackage(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Package id must be a positive integer');
  const { parseJsonBody } = require('../utils/body');
  const body = await parseJsonBody(req);
  const updated = await updateProviderPackage(req.user.id, Number(req.params.id), body);
  if (!updated) return fail(res, 404, 'Package not found');
  ok(res, updated);
}

async function deletePackage(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Package id must be a positive integer');
  const archived = await archiveProviderPackage(req.user.id, Number(req.params.id));
  if (!archived) return fail(res, 404, 'Package not found or already archived');
  ok(res, { id: Number(req.params.id), status: 'ARCHIVED' });
}

module.exports = {
  getMyPackages,
  getPackageFormOptions,
  createPackage,
  updatePackage,
  deletePackage,
};
