const { pool } = require('../config/db');

/** All finance and review queries are scoped through the authenticated provider's packages. */
async function getProviderFinance(providerId) {
  const [summaryRows] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END), 0) AS paid_total,
       COALESCE(SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END), 0) AS refunded_total,
       COUNT(CASE WHEN pay.status = 'PAID' THEN 1 END) AS paid_transactions,
       COUNT(CASE WHEN pay.status = 'REFUNDED' THEN 1 END) AS refunded_transactions
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?`,
    [providerId]
  );

  const [unpaidRows] = await pool.execute(
    `SELECT COUNT(*) AS unpaid_bookings,
            COALESCE(SUM(b.total_price), 0) AS unpaid_value
     FROM bookings b
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     LEFT JOIN payments pay ON pay.booking_id = b.id
     WHERE p.provider_id = ? AND b.status = 'PENDING' AND pay.id IS NULL`,
    [providerId]
  );

  const [packageRows] = await pool.execute(
    `SELECT p.id AS package_id, p.title AS package_title,
            COALESCE(SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END), 0) AS paid_total,
            COALESCE(SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END), 0) AS refunded_total,
            COUNT(DISTINCT b.id) AS booking_count
     FROM packages p
     LEFT JOIN package_departures pd ON pd.package_id = p.id
     LEFT JOIN bookings b ON b.departure_id = pd.id
     LEFT JOIN payments pay ON pay.booking_id = b.id
     WHERE p.provider_id = ?
     GROUP BY p.id, p.title
     ORDER BY paid_total DESC, p.title ASC`,
    [providerId]
  );

  const [recentRows] = await pool.execute(
    `SELECT pay.id AS payment_id, pay.booking_id, pay.amount, pay.method, pay.status,
            DATE_FORMAT(pay.paid_at, '%Y-%m-%d %H:%i') AS paid_at,
            p.title AS package_title, u.full_name AS customer_name
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     JOIN users u ON u.id = b.customer_id
     WHERE p.provider_id = ?
     ORDER BY pay.paid_at DESC, pay.id DESC
     LIMIT 20`,
    [providerId]
  );

  const summary = summaryRows[0];
  const paid = Number(summary.paid_total);
  const refunded = Number(summary.refunded_total);
  return {
    summary: {
      paid_total: paid,
      refunded_total: refunded,
      net_total: paid,
      paid_transactions: Number(summary.paid_transactions),
      refunded_transactions: Number(summary.refunded_transactions),
      unpaid_bookings: Number(unpaidRows[0].unpaid_bookings),
      unpaid_value: Number(unpaidRows[0].unpaid_value),
    },
    packages: packageRows.map((row) => ({
      ...row,
      paid_total: Number(row.paid_total),
      refunded_total: Number(row.refunded_total),
      net_total: Number(row.paid_total),
      booking_count: Number(row.booking_count),
    })),
    recent_payments: recentRows.map((row) => ({ ...row, amount: Number(row.amount) })),
  };
}

async function listProviderReviews(providerId) {
  const [rows] = await pool.execute(
    `SELECT r.id AS review_id, r.booking_id, r.rating, r.comment,
            DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS reviewed_at,
            p.id AS package_id, p.title AS package_title,
            u.full_name AS customer_name
     FROM reviews r
     JOIN bookings b ON b.id = r.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     JOIN users u ON u.id = b.customer_id
     WHERE p.provider_id = ?
     ORDER BY r.created_at DESC, r.id DESC`,
    [providerId]
  );

  const [statsRows] = await pool.execute(
    `SELECT COUNT(*) AS review_count, ROUND(AVG(r.rating), 1) AS average_rating,
            SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star,
            SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star,
            SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star,
            SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star,
            SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star
     FROM reviews r
     JOIN bookings b ON b.id = r.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?`,
    [providerId]
  );
  const stats = statsRows[0];
  return {
    stats: {
      review_count: Number(stats.review_count),
      average_rating: stats.average_rating === null ? null : Number(stats.average_rating),
      five_star: Number(stats.five_star || 0),
      four_star: Number(stats.four_star || 0),
      three_star: Number(stats.three_star || 0),
      two_star: Number(stats.two_star || 0),
      one_star: Number(stats.one_star || 0),
    },
    reviews: rows,
  };
}

module.exports = { getProviderFinance, listProviderReviews };
