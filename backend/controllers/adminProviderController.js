const { logAction } = require('../services/auditService');
const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { parsePaging, applyPaging } = require('../utils/pagination');
const {
  listProviders,
  getProvider,
  updateProvider,
} = require('../services/adminProviderService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getProviders(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const paging = parsePaging(url.searchParams);
    const providers = await listProviders({
      search: url.searchParams.get('search') || '',
      status: url.searchParams.get('status') || '',
    });
    return ok(res, applyPaging(providers, paging));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load providers');
  }
}

async function getProviderDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Provider id must be a positive integer');
  try {
    const provider = await getProvider(Number(req.params.id));
    if (!provider) return fail(res, 404, 'Provider not found');
    return ok(res, provider);
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load provider');
  }
}

async function updateProviderStatus(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Provider id must be a positive integer');
  const body = await parseJsonBody(req);
  if (!body || Object.keys(body).length !== 1) {
    return fail(res, 400, 'Provide exactly one status field');
  }
  if (body.provider_status !== undefined && !['APPROVED', 'REJECTED'].includes(body.provider_status)) {
    return fail(res, 400, 'provider_status must be APPROVED or REJECTED');
  }
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
    return fail(res, 400, 'is_active must be a boolean');
  }
  if (body.provider_status === undefined && body.is_active === undefined) {
    return fail(res, 400, 'provider_status or is_active is required');
  }
  try {
    const provider = await updateProvider(Number(req.params.id), body);
    const action = body.provider_status
      ? `PROVIDER_${body.provider_status}`
      : (body.is_active ? 'PROVIDER_UNBLOCKED' : 'PROVIDER_BLOCKED');
    await logAction(req.user.id, action, 'users', provider.id, provider.email);
    return ok(res, provider);
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to update provider');
  }
}

module.exports = { getProviders, getProviderDetails, updateProviderStatus };
