const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ALLOWED_METHODS = ['CARD', 'UPI', 'NET_BANKING'];

/**
 * Simulates a payment for a pending booking.
 * Locks booking with FOR UPDATE, re-verifies ownership and PENDING status,
 * inserts payment record, and updates booking to CONFIRMED atomically.
 */
async function payBooking({ customerId, bookingId, method }) {
  if (!ALLOWED_METHODS.includes(method)) {
    throw httpError(400, `Invalid payment method. Allowed methods: ${ALLOWED_METHODS.join(', ')}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock the booking row
    const [bRows] = await conn.execute(
      `SELECT id, customer_id, total_price, status
       FROM bookings
       WHERE id = ?
       FOR UPDATE`,
      [bookingId]
    );

    if (!bRows.length) {
      throw httpError(404, 'Booking not found');
    }

    const booking = bRows[0];
    if (booking.customer_id !== customerId) {
      throw httpError(403, 'You are not authorized to pay for this booking');
    }

    if (booking.status !== 'PENDING') {
      throw httpError(400, `Cannot process payment: booking status is ${booking.status}`);
    }

    // 2. Prevent duplicate payment check
    const [existingPayments] = await conn.execute(
      `SELECT id, status FROM payments WHERE booking_id = ? FOR UPDATE`,
      [bookingId]
    );
    if (existingPayments.length) {
      throw httpError(409, 'Payment has already been recorded for this booking');
    }

    // 3. Insert payment record
    const [payResult] = await conn.execute(
      `INSERT INTO payments (booking_id, amount, method, status)
       VALUES (?, ?, ?, 'PAID')`,
      [bookingId, booking.total_price, method]
    );

    // 4. Update booking status to CONFIRMED
    await conn.execute(
      `UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?`,
      [bookingId]
    );

    await conn.commit();

    return {
      payment_id: payResult.insertId,
      booking_id: bookingId,
      amount: booking.total_price,
      method,
      status: 'PAID',
      booking_status: 'CONFIRMED',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { payBooking };

