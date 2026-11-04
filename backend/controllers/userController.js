const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { getUserProfile, updateUserProfile } = require('../services/userService');

async function getProfile(req, res) {
  try {
    const profile = await getUserProfile(req.user.id);
    ok(res, profile);
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

async function updateProfile(req, res) {
  const body = await parseJsonBody(req);
  const { full_name, phone, address } = body || {};
  if (!full_name) {
    return fail(res, 400, 'full_name is required');
  }

  try {
    const updated = await updateUserProfile(req.user.id, {
      fullName: full_name,
      phone,
      address,
    });
    ok(res, updated);
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
