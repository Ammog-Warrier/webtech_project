const { pool } = require('../config/db');

/**
 * Returns available departures for an approved package starting from today.
 * Calculates available seats by deducting seats booked in PENDING and CONFIRMED bookings.
 */
async function listPackageDepartures(packageId) {
  const sql = `
    SELECT 
      pd.id,
      pd.package_id,
      DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS start_date,
      pd.seats_total,
      (pd.seats_total - COALESCE(b_sub.booked_seats, 0)) AS seats_available
    FROM package_departures pd
    JOIN packages p ON p.id = pd.package_id
    LEFT JOIN (
      SELECT departure_id, SUM(num_guests) AS booked_seats
      FROM bookings
      WHERE status IN ('PENDING', 'CONFIRMED')
      GROUP BY departure_id
    ) b_sub ON b_sub.departure_id = pd.id
    WHERE pd.package_id = ?
      AND p.status = 'APPROVED'
      AND pd.start_date >= CURDATE()
    ORDER BY pd.start_date ASC
  `;
  const [rows] = await pool.execute(sql, [packageId]);
  return rows.map((r) => ({
    ...r,
    seats_available: Math.max(0, Number(r.seats_available)),
  }));
}

module.exports = { listPackageDepartures };

