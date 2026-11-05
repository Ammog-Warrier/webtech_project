const { ok, fail } = require('../utils/response');
const { parsePaging, applyPaging } = require('../utils/pagination');
const { parseDateRange } = require('../utils/dates');
const { listBookings, getBooking } = require('../services/adminBookingService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getBookings(req, res) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const paging = parsePaging(params);
    const { from, to } = parseDateRange(params.get('from'), params.get('to'));
    const bookings = await listBookings({
      status: params.get('status') || '',
      paymentStatus: params.get('payment_status') || '',
      search: params.get('search') || '',
      from,
      to,
    });
    return ok(res, applyPaging(bookings, paging));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load bookings');
  }
}

async function getBookingDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Booking id must be a positive integer');
  try {
    const booking = await getBooking(Number(req.params.id));
    if (!booking) return fail(res, 404, 'Booking not found');
    return ok(res, booking);
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load booking');
  }
}

module.exports = { getBookings, getBookingDetails };
