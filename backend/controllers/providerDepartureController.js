const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const {
  listProviderDepartures,
  listProviderApprovedPackages,
  createProviderDeparture,
  updateProviderDeparture,
  deleteProviderDeparture,
} = require('../services/providerDepartureService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getMyDepartures(req, res) {
  ok(res, await listProviderDepartures(req.user.id));
}

async function getDeparturePackages(req, res) {
  ok(res, await listProviderApprovedPackages(req.user.id));
}

async function createDeparture(req, res) {
  const body = await parseJsonBody(req);
  ok(res, await createProviderDeparture(req.user.id, body), 201);
}

async function updateDeparture(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Departure id must be a positive integer');
  const body = await parseJsonBody(req);
  const updated = await updateProviderDeparture(req.user.id, Number(req.params.id), body);
  if (!updated) return fail(res, 404, 'Departure not found');
  ok(res, updated);
}

async function deleteDeparture(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Departure id must be a positive integer');
  const result = await deleteProviderDeparture(req.user.id, Number(req.params.id));
  if (result.notFound) return fail(res, 404, 'Departure not found');
  ok(res, { id: Number(req.params.id), deleted: true });
}

module.exports = {
  getMyDepartures,
  getDeparturePackages,
  createDeparture,
  updateDeparture,
  deleteDeparture,
};
