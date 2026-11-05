const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const {
  createBooking,
  getCustomerBookings,
  cancelBooking,
} = require('../services/bookingService');
const { payBooking } = require('../services/paymentService');
const { createReview } = require('../services/reviewService');

async function createNewBooking(req, res) {
  const body = await parseJsonBody(req);
  const { departure_id, num_guests } = body || {};
  if (!departure_id || !num_guests) {
    return fail(res, 400, 'departure_id and num_guests are required');
  }

  try {
    const booking = await createBooking({
      customerId: req.user.id,
      departureId: Number(departure_id),
      numGuests: Number(num_guests),
    });
    ok(res, booking, 201);
  } catch (err) {
    fail(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
  }
}

async function getMyBookings(req, res) {
  try {
    const bookings = await getCustomerBookings(req.user.id);
    ok(res, bookings);
  } catch (err) {
    fail(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
  }
}

async function cancelMyBooking(req, res) {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return fail(res, 400, 'id must be an integer');
  }

  try {
    const result = await cancelBooking({
      customerId: req.user.id,
      bookingId,
    });
    ok(res, result);
  } catch (err) {
    fail(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
  }
}

async function payForBooking(req, res) {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return fail(res, 400, 'id must be an integer');
  }

  const body = await parseJsonBody(req);
  const { method } = body || {};
  if (!method) {
    return fail(res, 400, 'method is required (CARD, UPI, NET_BANKING)');
  }

  try {
    const payment = await payBooking({
      customerId: req.user.id,
      bookingId,
      method,
    });
    ok(res, payment);
  } catch (err) {
    fail(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
  }
}

async function reviewMyBooking(req, res) {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return fail(res, 400, 'id must be an integer');
  }

  const body = await parseJsonBody(req);
  const { rating, comment } = body || {};
  if (rating === undefined || rating === null) {
    return fail(res, 400, 'rating is required (1 to 5)');
  }

  try {
    const review = await createReview({
      customerId: req.user.id,
      bookingId,
      rating,
      comment,
    });
    ok(res, review, 201);
  } catch (err) {
    fail(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
  }
}

module.exports = {
  createNewBooking,
  getMyBookings,
  cancelMyBooking,
  payForBooking,
  reviewMyBooking,
};
