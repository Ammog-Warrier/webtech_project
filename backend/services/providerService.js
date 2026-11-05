const { pool } = require('../config/db');

/**
 * Returns the authenticated provider's approval state and dashboard summary.
 * Every aggregate is scoped through packages.provider_id = providerId.
 */
async function getProviderDashboard(providerId) {
  const [rows] = await pool.execute(
    `SELECT
       u.provider_status,
       (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id) AS total_packages,
       (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id AND p.status = 'PENDING') AS pending_packages,
       (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id AND p.status = 'APPROVED') AS approved_packages,
       (SELECT COUNT(*) FROM packages p WHERE p.provider_id = u.id AND p.status = 'REJECTED') AS rejected_packages,
       (SELECT COUNT(*)
          FROM bookings b
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id) AS total_bookings,
       (SELECT COUNT(*)
          FROM bookings b
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id AND b.status = 'PENDING') AS pending_bookings,
       (SELECT COUNT(*)
          FROM bookings b
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id AND b.status = 'CONFIRMED') AS confirmed_bookings,
       (SELECT COUNT(*)
          FROM bookings b
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id
           AND (b.status = 'COMPLETED'
             OR (b.status = 'CONFIRMED' AND CURDATE() >= DATE_ADD(pd.start_date, INTERVAL p.duration_days DAY)))) AS completed_bookings,
       (SELECT COALESCE(SUM(pay.amount), 0)
          FROM payments pay
          JOIN bookings b ON b.id = pay.booking_id
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id AND pay.status = 'PAID') AS total_earnings,
       (SELECT ROUND(AVG(r.rating), 1)
          FROM reviews r
          JOIN bookings b ON b.id = r.booking_id
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id) AS average_rating,
       (SELECT COUNT(*)
          FROM reviews r
          JOIN bookings b ON b.id = r.booking_id
          JOIN package_departures pd ON pd.id = b.departure_id
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id) AS review_count,
       (SELECT COUNT(*)
          FROM package_departures pd
          JOIN packages p ON p.id = pd.package_id
         WHERE p.provider_id = u.id AND pd.start_date >= CURDATE()) AS upcoming_departures
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND r.name = 'PROVIDER'`,
    [providerId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    provider_status: row.provider_status,
    total_packages: Number(row.total_packages),
    pending_packages: Number(row.pending_packages),
    approved_packages: Number(row.approved_packages),
    rejected_packages: Number(row.rejected_packages),
    total_bookings: Number(row.total_bookings),
    pending_bookings: Number(row.pending_bookings),
    confirmed_bookings: Number(row.confirmed_bookings),
    completed_bookings: Number(row.completed_bookings),
    total_earnings: Number(row.total_earnings),
    average_rating: row.average_rating === null ? null : Number(row.average_rating),
    review_count: Number(row.review_count),
    upcoming_departures: Number(row.upcoming_departures),
  };
}

module.exports = { getProviderDashboard };
