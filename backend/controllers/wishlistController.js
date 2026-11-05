const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const {
  listWishlist,
  addToWishlist,
  removeFromWishlist,
} = require('../services/wishlistService');

const isId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;

function handleError(res, err, fallback) {
  return fail(res, err.status || 500, err.status ? err.message : fallback);
}

async function getWishlist(req, res) {
  try {
    return ok(res, await listWishlist(req.user.id));
  } catch (err) {
    return handleError(res, err, 'Unable to load wishlist');
  }
}

async function addWishlistItem(req, res) {
  try {
    const body = await parseJsonBody(req);
    if (!body || !isId(body.package_id)) return fail(res, 400, 'package_id must be a positive integer');
    const { added } = await addToWishlist(req.user.id, Number(body.package_id));
    return ok(res, { package_id: Number(body.package_id), wishlisted: true }, added ? 201 : 200);
  } catch (err) {
    return handleError(res, err, 'Unable to update wishlist');
  }
}

async function removeWishlistItem(req, res) {
  if (!isId(req.params.packageId)) return fail(res, 400, 'Package id must be a positive integer');
  try {
    const { removed } = await removeFromWishlist(req.user.id, Number(req.params.packageId));
    return ok(res, { package_id: Number(req.params.packageId), wishlisted: false, removed });
  } catch (err) {
    return handleError(res, err, 'Unable to update wishlist');
  }
}

module.exports = { getWishlist, addWishlistItem, removeWishlistItem };
