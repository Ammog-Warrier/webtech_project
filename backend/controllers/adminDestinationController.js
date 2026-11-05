const { logAction } = require('../services/auditService');
const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const {
  listAdminDestinations,
  getAdminDestination,
  createAdminDestinationRecord,
  updateAdminDestinationRecord,
  deleteAdminDestinationRecord,
} = require('../services/adminDestinationService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function validateDestination(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'A JSON object is required';
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';

  if (!name) return 'Destination name is required';
  if (name.length > 100) return 'Destination name must be 100 characters or fewer';
  if (!description) return 'Destination description is required';
  if (!imageUrl) return 'Destination image URL is required';
  if (imageUrl.length > 255) return 'Image URL must be 255 characters or fewer';
  return null;
}

function cleanDestination(body) {
  return {
    name: body.name.trim(),
    description: body.description.trim(),
    image_url: body.image_url.trim(),
  };
}

async function getDestinations(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const destinations = await listAdminDestinations(url.searchParams.get('search') || '');
    return ok(res, destinations);
  } catch (err) {
    return fail(res, err.status || 500, err.message || 'Unable to load destinations');
  }
}

async function getDestinationDetails(req, res) {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'Destination id must be a positive integer');
  }
  try {
    const destination = await getAdminDestination(Number(req.params.id));
    if (!destination) return fail(res, 404, 'Destination not found');
    return ok(res, destination);
  } catch (err) {
    return fail(res, err.status || 500, err.message || 'Unable to load destination');
  }
}

async function createDestination(req, res) {
  try {
    const body = await parseJsonBody(req);
    const validationError = validateDestination(body);
    if (validationError) return fail(res, 400, validationError);
    const destination = await createAdminDestinationRecord(cleanDestination(body));
    await logAction(req.user.id, 'DESTINATION_CREATED', 'destinations', destination.id, destination.name);
    return ok(res, destination, 201);
  } catch (err) {
    return fail(res, err.status || 500, err.message || 'Unable to create destination');
  }
}

async function updateDestination(req, res) {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'Destination id must be a positive integer');
  }
  try {
    const body = await parseJsonBody(req);
    const validationError = validateDestination(body);
    if (validationError) return fail(res, 400, validationError);
    const destination = await updateAdminDestinationRecord(
      Number(req.params.id),
      cleanDestination(body)
    );
    await logAction(req.user.id, 'DESTINATION_UPDATED', 'destinations', destination.id, destination.name);
    return ok(res, destination);
  } catch (err) {
    return fail(res, err.status || 500, err.message || 'Unable to update destination');
  }
}

async function deleteDestination(req, res) {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'Destination id must be a positive integer');
  }
  try {
    await deleteAdminDestinationRecord(Number(req.params.id));
    await logAction(req.user.id, 'DESTINATION_DELETED', 'destinations', Number(req.params.id), null);
    return ok(res, { message: 'Destination deleted successfully' });
  } catch (err) {
    return fail(res, err.status || 500, err.message || 'Unable to delete destination');
  }
}

module.exports = {
  getDestinations,
  getDestinationDetails,
  createDestination,
  updateDestination,
  deleteDestination,
};
