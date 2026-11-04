const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Creates a review for a booking.
 * Verifies that:
 * 1. Booking belongs to customer.
 * 2. Trip is completed (booking status is COMPLETED or CONFIRMED and CURDATE() >= start_date + duration_days).
 * 3. Exactly one review per booking.
 * 4. Rating is between 1 and 5.
 */
async function createReview({ customerId, bookingId, rating, comment }) {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw httpError(400, 'Rating must be an integer between 1 and 5');
  }

  const cleanComment = comment ? String(comment).trim() : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock and check booking details
    const [bRows] = await conn.execute(
      `SELECT b.id, b.customer_id, b.status, pd.start_date, p.duration_days,
              DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY) AS trip_end_date,
              (CURDATE() >= DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY)) AS is_trip_completed
       FROM bookings b
       JOIN package_departures pd ON pd.id = b.departure_id
       JOIN packages p ON p.id = pd.package_id
       WHERE b.id = ?
       FOR UPDATE`,
      [bookingId]
    );

    if (!bRows.length) {
      throw httpError(404, 'Booking not found');
    }

    const booking = bRows[0];
    if (booking.customer_id !== customerId) {
      throw httpError(403, 'You are not authorized to review this booking');
    }

    const isEligibleStatus = booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && booking.is_trip_completed);
    if (!isEligibleStatus) {
      throw httpError(400, 'Reviews can only be submitted after the trip has been completed');
    }

    // 2. Check duplicate review
    const [existing] = await conn.execute(
      `SELECT id FROM reviews WHERE booking_id = ?`,
      [bookingId]
    );
    if (existing.length) {
      throw httpError(409, 'You have already submitted a review for this booking');
    }

    // 3. Insert review
    const [result] = await conn.execute(
      `INSERT INTO reviews (booking_id, rating, comment)
       VALUES (?, ?, ?)`,
      [bookingId, numericRating, cleanComment]
    );

    // If status was CONFIRMED and trip has completed, ensure booking status transitions to COMPLETED
    if (booking.status === 'CONFIRMED') {
      await conn.execute(
        `UPDATE bookings SET status = 'COMPLETED' WHERE id = ?`,
        [bookingId]
      );
    }

    await conn.commit();

    return {
      id: result.insertId,
      booking_id: bookingId,
      rating: numericRating,
      comment: cleanComment,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createReview };

