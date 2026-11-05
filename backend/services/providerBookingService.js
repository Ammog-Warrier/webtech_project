const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const BOOKING_SELECT = `
  SELECT b.id, b.customer_id, b.departure_id, b.num_guests, b.total_price,
         b.status AS booking_status,
         DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS booked_at,
         DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS departure_date,
         p.id AS package_id, p.title AS package_title,
         u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
         pay.id AS payment_id, pay.amount AS payment_amount,
         pay.method AS payment_method, pay.status AS payment_status,
         r.rating AS review_rating
    FROM bookings b
    JOIN package_departures pd ON pd.id = b.departure_id
    JOIN packages p ON p.id = pd.package_id
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN payments pay ON pay.booking_id = b.id
    LEFT JOIN reviews r ON r.booking_id = b.id`;

async function listProviderBookings(providerId, filters = {}) {
  const conditions = ['p.provider_id = ?'];
  const params = [providerId];
  const status = String(filters.status || '').toUpperCase();
  const allowed = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
  if (status && allowed.includes(status)) {
    conditions.push('b.status = ?');
    params.push(status);
  }
  const [rows] = await pool.execute(
    `${BOOKING_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY b.created_at DESC, b.id DESC`,
    params
  );
  return rows;
}

async function getProviderBooking(providerId, bookingId) {
  const [rows] = await pool.execute(
    `${BOOKING_SELECT} WHERE p.provider_id = ? AND b.id = ? LIMIT 1`,
    [providerId, bookingId]
  );
  return rows[0] || null;
}

// Payment processing normally confirms paid bookings automatically. This endpoint
// safely supports provider confirmation only when a PAID payment already exists.
async function confirmProviderBooking(providerId, bookingId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT b.id, b.status, pay.status AS payment_status
         FROM bookings b
         JOIN package_departures pd ON pd.id = b.departure_id
         JOIN packages p ON p.id = pd.package_id
         LEFT JOIN payments pay ON pay.booking_id = b.id
        WHERE b.id = ? AND p.provider_id = ?
        FOR UPDATE`,
      [bookingId, providerId]
    );
    if (!rows.length) throw httpError(404, 'Booking not found');
    const booking = rows[0];
    if (booking.status === 'CONFIRMED') {
      await conn.commit();
      return { id: bookingId, status: 'CONFIRMED', alreadyConfirmed: true };
    }
    if (booking.status !== 'PENDING') {
      throw httpError(400, `Cannot confirm a booking with status ${booking.status}`);
    }
    if (booking.payment_status !== 'PAID') {
      throw httpError(400, 'A booking can only be confirmed after payment is marked PAID');
    }
    await conn.execute(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?`, [bookingId]);
    await conn.commit();
    return { id: bookingId, status: 'CONFIRMED' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listProviderBookings, getProviderBooking, confirmProviderBooking };
