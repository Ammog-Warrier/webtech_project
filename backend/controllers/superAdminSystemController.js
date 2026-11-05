const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { parsePaging } = require('../utils/pagination');
const { parseDateRange } = require('../utils/dates');
const { logAction } = require('../services/auditService');
const { listLogs } = require('../services/auditLogService');
const { listSettings, updateSetting } = require('../services/settingsService');

function handleError(res, err, fallback) {
  return fail(res, err.status || 500, err.status ? err.message : fallback);
}

// Audit log viewer. Always paginated (default 20 per page, max 100).
async function getLogs(req, res) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const paging = parsePaging(params) || { page: 1, limit: 10 };
    if (params.get('page') === null && params.get('limit') === null) paging.limit = 20;
    const { from, to } = parseDateRange(params.get('from'), params.get('to'));
    const rawUser = params.get('user_id');
    if (rawUser !== null && rawUser !== '' && !/^\d+$/.test(rawUser)) {
      return fail(res, 400, 'user_id must be a positive integer');
    }
    return ok(res, await listLogs({
      userId: rawUser ? Number(rawUser) : null,
      action: (params.get('action') || '').trim().slice(0, 50),
      entity: (params.get('entity') || '').trim().slice(0, 50),
      search: (params.get('search') || '').trim().slice(0, 100),
      from,
      to,
      page: paging.page,
      limit: paging.limit,
    }));
  } catch (err) {
    return handleError(res, err, 'Unable to load logs');
  }
}

async function getSettings(req, res) {
  try {
    return ok(res, await listSettings());
  } catch (err) {
    return handleError(res, err, 'Unable to load settings');
  }
}

async function putSetting(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { setting, previous } = await updateSetting(req.params.key, body && body.value);
    await logAction(req.user.id, 'SETTING_UPDATED', 'settings', null, `${setting.setting_key}: ${previous} -> ${setting.setting_value}`);
    return ok(res, setting);
  } catch (err) {
    return handleError(res, err, 'Unable to update setting');
  }
}

module.exports = { getLogs, getSettings, putSetting };
