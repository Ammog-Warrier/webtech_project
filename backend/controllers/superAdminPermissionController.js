const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { logAction } = require('../services/auditService');
const { PERMISSIONS } = require('../utils/permissions');
const { getAdmin } = require('../services/superAdminAdminService');
const { getAdminPermissions, setAdminPermissions } = require('../services/permissionService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

// Every permission an admin can be given, with a description
async function listPermissions(req, res) {
  return ok(res, Object.entries(PERMISSIONS).map(([name, description]) => ({ name, description })));
}

async function getPermissions(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const admin = await getAdmin(Number(req.params.id));
    if (!admin) return fail(res, 404, 'Admin not found');
    return ok(res, { admin_id: admin.id, permissions: await getAdminPermissions(admin.id) });
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load permissions');
  }
}

// Replaces the admin's whole permission set. Takes effect immediately (no re-login needed).
async function updatePermissions(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const body = await parseJsonBody(req);
    const admin = await getAdmin(Number(req.params.id));
    if (!admin) return fail(res, 404, 'Admin not found');
    const permissions = await setAdminPermissions(admin.id, body && body.permissions);
    await logAction(req.user.id, 'ADMIN_PERMISSIONS_UPDATED', 'users', admin.id, permissions.join(', ') || 'none');
    return ok(res, { admin_id: admin.id, permissions });
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to update permissions');
  }
}

module.exports = { listPermissions, getPermissions, updatePermissions };
