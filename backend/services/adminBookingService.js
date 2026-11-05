const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['PAID', 'REFUNDED', 'UNPAID'];

const BOOKING_SELECT = `
  SELECT b.id, b.num_guests, b.total_price, b.status,
         DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') AS booked_at,
         DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS departure_date,
         pd.id AS departure_id,
         p.id AS package_id, p.title AS package_title, p.duration_days,
         d.name AS destination_name,
         cu.id AS customer_id, cu.full_name AS customer_name, cu.email AS customer_email,
         cu.phone AS customer_phone,
         pr.id AS provider_id, pr.full_name AS provider_name,
         pay.amount AS payment_amount, pay.method AS payment_method,
         COALESCE(pay.status, 'UNPAID') AS payment_status,
         DATE_FORMAT(pay.paid_at, '%Y-%m-%d %H:%i') AS paid_at,
         r.rating AS review_rating, r.comment AS review_comment
    FROM bookings b
    JOIN package_departures pd ON pd.id = b.departure_id
    JOIN packages p ON p.id = pd.package_id
    JOIN destinations d ON d.id = p.destination_id
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN users pr ON pr.id = p.provider_id
    LEFT JOIN payments pay ON pay.booking_id = b.id
    LEFT JOIN reviews r ON r.booking_id = b.id`;

// Read-only monitoring: filters by status, payment status, free text and booking date range.
async function listBookings({ status = '', paymentStatus = '', search = '', from = null, to = null } = {}) {
  const conditions = ['1 = 1'];
  const params = [];
  const cleanStatus = String(status).toUpperCase();
  const cleanPayment = String(paymentStatus).toUpperCase();
  const cleanSearch = String(search).trim();

  if (cleanStatus) {
    if (!BOOKING_STATUSES.includes(cleanStatus)) throw httpError(400, 'Invalid status filter');
    conditions.push('b.status = ?');
    params.push(cleanStatus);
  }
  if (cleanPayment) {
    if (!PAYMENT_STATUSES.includes(cleanPayment)) throw httpError(400, 'Invalid payment_status filter');
    if (cleanPayment === 'UNPAID') conditions.push('pay.id IS NULL');
    else {
      conditions.push('pay.status = ?');
      params.push(cleanPayment);
    }
  }
  if (cleanSearch) {
    conditions.push('(cu.full_name LIKE ? OR cu.email LIKE ? OR p.title LIKE ? OR pr.full_name LIKE ?)');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term, term);
  }
  if (from) {
    conditions.push('DATE(b.created_at) >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('DATE(b.created_at) <= ?');
    params.push(to);
  }

  const [rows] = await pool.execute(
    `${BOOKING_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY b.created_at DESC, b.id DESC`,
    params
  );
  return rows;
}

async function getBooking(bookingId) {
  const [rows] = await pool.execute(`${BOOKING_SELECT} WHERE b.id = ? LIMIT 1`, [bookingId]);
  return rows[0] || null;
}

module.exports = { listBookings, getBooking };
