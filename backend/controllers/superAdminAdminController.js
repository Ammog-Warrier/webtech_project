const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { parsePaging, applyPaging } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const { PERMISSION_NAMES } = require('../utils/permissions');
const {
  listAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  setAdminActive,
  deleteAdmin,
} = require('../services/superAdminAdminService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isText = (value) => typeof value === 'string';

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

// Validates the shared admin fields. Returns { error } or { value }.
function validateAdminBody(body, { passwordRequired }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'A JSON object is required' };
  const fullName = isText(body.full_name) ? body.full_name.trim() : '';
  const email = isText(body.email) ? body.email.trim().toLowerCase() : '';
  const phone = isText(body.phone) && body.phone.trim() ? body.phone.trim() : null;
  const password = body.password === undefined || body.password === '' ? null : body.password;

  if (!fullName || fullName.length > 100) return { error: 'Full name is required (max 100 characters)' };
  if (!EMAIL_PATTERN.test(email) || email.length > 150) return { error: 'A valid email is required' };
  if (phone && !/^[0-9+()\- ]{6,20}$/.test(phone)) return { error: 'Phone number is not valid' };
  if (password === null) {
    if (passwordRequired) return { error: 'Password must be 8 to 72 characters' };
  } else if (!isText(password) || password.length < 8 || Buffer.byteLength(password) > 72) {
    return { error: 'Password must be 8 to 72 characters' };
  }
  let permissions = [];
  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) || body.permissions.some((name) => !PERMISSION_NAMES.includes(name))) {
      return { error: `permissions must be an array of: ${PERMISSION_NAMES.join(', ')}` };
    }
    permissions = [...new Set(body.permissions)];
  }
  return { value: { fullName, email, phone, password, permissions } };
}

function handleError(res, err, fallback) {
  return fail(res, err.status || 500, err.status ? err.message : fallback);
}

async function getAdmins(req, res) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const paging = parsePaging(params);
    const admins = await listAdmins({
      search: params.get('search') || '',
      status: params.get('status') || '',
    });
    return ok(res, applyPaging(admins, paging));
  } catch (err) {
    return handleError(res, err, 'Unable to load admins');
  }
}

async function getAdminDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const admin = await getAdmin(Number(req.params.id));
    if (!admin) return fail(res, 404, 'Admin not found');
    return ok(res, admin);
  } catch (err) {
    return handleError(res, err, 'Unable to load admin');
  }
}

async function createAdminAccount(req, res) {
  try {
    const checked = validateAdminBody(await parseJsonBody(req), { passwordRequired: true });
    if (checked.error) return fail(res, 400, checked.error);
    const admin = await createAdmin(checked.value);
    await logAction(req.user.id, 'ADMIN_CREATED', 'users', admin.id, admin.email);
    if (checked.value.permissions.length) {
      await logAction(req.user.id, 'ADMIN_PERMISSIONS_UPDATED', 'users', admin.id, checked.value.permissions.join(', '));
    }
    return ok(res, admin, 201);
  } catch (err) {
    return handleError(res, err, 'Unable to create admin');
  }
}

async function updateAdminAccount(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const checked = validateAdminBody(await parseJsonBody(req), { passwordRequired: false });
    if (checked.error) return fail(res, 400, checked.error);
    const admin = await updateAdmin(Number(req.params.id), checked.value);
    await logAction(req.user.id, 'ADMIN_UPDATED', 'users', admin.id, checked.value.password ? `${admin.email} (password reset)` : admin.email);
    return ok(res, admin);
  } catch (err) {
    return handleError(res, err, 'Unable to update admin');
  }
}

async function updateAdminStatus(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const body = await parseJsonBody(req);
    if (!body || typeof body.is_active !== 'boolean') return fail(res, 400, 'is_active must be a boolean');
    const admin = await setAdminActive(Number(req.params.id), body.is_active);
    await logAction(req.user.id, body.is_active ? 'ADMIN_ENABLED' : 'ADMIN_DISABLED', 'users', admin.id, admin.email);
    return ok(res, admin);
  } catch (err) {
    return handleError(res, err, 'Unable to update admin status');
  }
}

async function deleteAdminAccount(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Admin id must be a positive integer');
  try {
    const admin = await deleteAdmin(Number(req.params.id));
    await logAction(req.user.id, 'ADMIN_DELETED', 'users', admin.id, admin.email);
    return ok(res, { message: 'Admin deleted successfully' });
  } catch (err) {
    return handleError(res, err, 'Unable to delete admin');
  }
}

module.exports = {
  getAdmins,
  getAdminDetails,
  createAdminAccount,
  updateAdminAccount,
  updateAdminStatus,
  deleteAdminAccount,
};
