const { ok, fail } = require('../utils/response');
const {
  listProviderBookings,
  getProviderBooking,
  confirmProviderBooking,
} = require('../services/providerBookingService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getMyBookings(req, res) {
  try {
    const bookings = await listProviderBookings(req.user.id);
    ok(res, bookings);
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

async function getBookingDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Booking id must be a positive integer');
  try {
    const booking = await getProviderBooking(req.user.id, Number(req.params.id));
    if (!booking) return fail(res, 404, 'Booking not found');
    ok(res, booking);
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

async function confirmBooking(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Booking id must be a positive integer');
  try {
    ok(res, await confirmProviderBooking(req.user.id, Number(req.params.id)));
  } catch (err) {
    fail(res, err.status || 500, err.message);
  }
}

module.exports = { getMyBookings, getBookingDetails, confirmBooking };
