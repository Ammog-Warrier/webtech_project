const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Creates a customer booking with pessimistic row-locking on package_departures.
 * Enforces atomic seat availability calculation and calculates total_price snapshot.
 */
async function createBooking({ customerId, departureId, numGuests }) {
  if (!Number.isInteger(departureId) || departureId <= 0) {
    throw httpError(400, 'Invalid departure_id');
  }
  if (!Number.isInteger(numGuests) || numGuests < 1) {
    throw httpError(400, 'num_guests must be a positive integer (at least 1)');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock the departure row explicitly with FOR UPDATE
    const [depRows] = await conn.execute(
      `SELECT pd.id, pd.package_id, pd.start_date, pd.seats_total,
              p.price, p.status AS package_status, p.max_group_size
       FROM package_departures pd
       JOIN packages p ON p.id = pd.package_id
       WHERE pd.id = ?
       FOR UPDATE`,
      [departureId]
    );

    if (!depRows.length) {
      throw httpError(404, 'Departure not found');
    }

    const departure = depRows[0];
    if (departure.package_status !== 'APPROVED') {
      throw httpError(400, 'The selected package is currently not available for booking');
    }

    const startDate = new Date(departure.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw httpError(400, 'Cannot book a departure date in the past');
    }

    if (numGuests > departure.max_group_size) {
      throw httpError(400, `Guest count exceeds package maximum group size of ${departure.max_group_size}`);
    }

    // 2. Count seats occupied by PENDING or CONFIRMED bookings within transaction
    const [occupiedRows] = await conn.execute(
      `SELECT COALESCE(SUM(num_guests), 0) AS occupied_seats
       FROM bookings
       WHERE departure_id = ?
         AND status IN ('PENDING', 'CONFIRMED')`,
      [departureId]
    );

    const occupiedSeats = Number(occupiedRows[0].occupied_seats);
    const seatsAvailable = departure.seats_total - occupiedSeats;

    if (numGuests > seatsAvailable) {
      throw httpError(400, `Insufficient seats available. Only ${Math.max(0, seatsAvailable)} seat(s) left`);
    }

    // 3. Compute price snapshot and insert booking
    const totalPrice = (Number(departure.price) * numGuests).toFixed(2);
    const [insertResult] = await conn.execute(
      `INSERT INTO bookings (customer_id, departure_id, num_guests, total_price, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [customerId, departureId, numGuests, totalPrice]
    );

    await conn.commit();

    return {
      id: insertResult.insertId,
      customer_id: customerId,
      departure_id: departureId,
      num_guests: numGuests,
      total_price: totalPrice,
      status: 'PENDING',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Returns booking history for the logged-in customer.
 * Evaluates completed status based on trip end date (start_date + duration_days).
 */
async function getCustomerBookings(customerId) {
  const sql = `
    SELECT 
      b.id,
      b.departure_id,
      b.num_guests,
      b.total_price,
      b.status AS raw_status,
      DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS created_at,
      DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS departure_date,
      pd.start_date,
      p.id AS package_id,
      p.title AS package_title,
      p.image_url AS package_image,
      p.duration_days,
      d.name AS destination_name,
      pay.id AS payment_id,
      pay.amount AS payment_amount,
      pay.method AS payment_method,
      pay.status AS payment_status,
      r.id AS review_id,
      r.rating AS review_rating,
      r.comment AS review_comment,
      -- Check if completed: CONFIRMED and current date >= start_date + duration_days
      CASE 
        WHEN b.status = 'CONFIRMED' AND CURDATE() >= DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY) THEN 'COMPLETED'
        ELSE b.status
      END AS status,
      -- Eligible for review if completed and not yet reviewed
      CASE 
        WHEN (b.status = 'COMPLETED' OR (b.status = 'CONFIRMED' AND CURDATE() >= DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY)))
             AND r.id IS NULL THEN 1
        ELSE 0
      END AS review_eligible
    FROM bookings b
    JOIN package_departures pd ON pd.id = b.departure_id
    JOIN packages p ON p.id = pd.package_id
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN payments pay ON pay.booking_id = b.id
    LEFT JOIN reviews r ON r.booking_id = b.id
    WHERE b.customer_id = ?
    ORDER BY b.id DESC
  `;
  const [rows] = await pool.execute(sql, [customerId]);
  return rows;
}

/**
 * Cancels a booking with cancellation eligibility check against system settings.
 * If CONFIRMED and paid, transitions booking to CANCELLED and marks payment REFUNDED atomically.
 */
async function cancelBooking({ customerId, bookingId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock booking row and check ownership
    const [bRows] = await conn.execute(
      `SELECT b.id, b.customer_id, b.departure_id, b.status, pd.start_date
       FROM bookings b
       JOIN package_departures pd ON pd.id = b.departure_id
       WHERE b.id = ?
       FOR UPDATE`,
      [bookingId]
    );

    if (!bRows.length) {
      throw httpError(404, 'Booking not found');
    }

    const booking = bRows[0];
    if (booking.customer_id !== customerId) {
      throw httpError(403, 'You are not authorized to cancel this booking');
    }

    if (booking.status === 'CANCELLED') {
      throw httpError(400, 'This booking has already been cancelled');
    }
    if (booking.status === 'COMPLETED') {
      throw httpError(400, 'Completed trips cannot be cancelled');
    }

    // 2. Query cancellation cutoff hours from settings table (defaults to 24)
    const [setRows] = await conn.execute(
      `SELECT setting_value FROM settings WHERE setting_key = 'booking_cancellation_hours_limit'`
    );
    const cancellationHours = setRows.length ? Number(setRows[0].setting_value) : 24;

    // Check departure cutoff time against current database timestamp
    const [eligibilityCheck] = await conn.execute(
      `SELECT (pd.start_date <= DATE_ADD(NOW(), INTERVAL ? HOUR)) AS is_past_cutoff
       FROM package_departures pd
       WHERE pd.id = ?`,
      [cancellationHours, booking.departure_id]
    );

    if (eligibilityCheck[0].is_past_cutoff) {
      throw httpError(400, `Cancellations must be requested at least ${cancellationHours} hours prior to departure date`);
    }

    // 3. Update booking status
    await conn.execute(
      `UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`,
      [bookingId]
    );

    // 4. If payment exists and is PAID, mark as REFUNDED
    let refundIssued = false;
    const [payRows] = await conn.execute(
      `SELECT id, status FROM payments WHERE booking_id = ? FOR UPDATE`,
      [bookingId]
    );
    if (payRows.length && payRows[0].status === 'PAID') {
      await conn.execute(
        `UPDATE payments SET status = 'REFUNDED' WHERE booking_id = ?`,
        [bookingId]
      );
      refundIssued = true;
    }

    await conn.commit();

    return {
      id: bookingId,
      status: 'CANCELLED',
      refundIssued,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Persists the COMPLETED status for CONFIRMED bookings whose trip has ended
 * (current date >= start_date + duration_days, the same rule the customer view and reviews use).
 * Keeps admin and provider statistics, which read the stored status, accurate. Returns the number updated.
 */
async function completePastBookings() {
  const [result] = await pool.execute(
    `UPDATE bookings b
       JOIN package_departures pd ON pd.id = b.departure_id
       JOIN packages p ON p.id = pd.package_id
        SET b.status = 'COMPLETED'
      WHERE b.status = 'CONFIRMED'
        AND CURDATE() >= DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY)`
  );
  return result.affectedRows;
}

module.exports = {
  createBooking,
  getCustomerBookings,
  cancelBooking,
  completePastBookings,
};

