const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// A departure is LIMITED when 25% or fewer of its seats are left.
function departureStatus({ isPast, seatsAvailable, seatsTotal }) {
  if (isPast) return 'PAST';
  if (seatsAvailable <= 0) return 'SOLD_OUT';
  if (seatsAvailable <= Math.ceil(seatsTotal * 0.25)) return 'LIMITED';
  return 'AVAILABLE';
}

// Departures of an approved package that start in the given month, with live seat availability.
// end_date is the last day of the trip (inclusive).
async function getPackageCalendar(packageId, range) {
  const [pkg] = await pool.execute(
    "SELECT id, title, duration_days FROM packages WHERE id = ? AND status = 'APPROVED'",
    [packageId]
  );
  if (!pkg.length) throw httpError(404, 'Package not found');

  const [rows] = await pool.execute(
    `SELECT pd.id AS departure_id,
            DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS date,
            DATE_FORMAT(DATE_ADD(pd.start_date, INTERVAL ? DAY), '%Y-%m-%d') AS end_date,
            pd.seats_total,
            pd.seats_total - COALESCE(bk.booked, 0) AS seats_available,
            (pd.start_date < CURDATE()) AS is_past
       FROM package_departures pd
       LEFT JOIN (
         SELECT departure_id, SUM(num_guests) AS booked
           FROM bookings WHERE status IN ('PENDING', 'CONFIRMED') GROUP BY departure_id
       ) bk ON bk.departure_id = pd.id
      WHERE pd.package_id = ? AND pd.start_date BETWEEN ? AND ?
      ORDER BY pd.start_date`,
    [String(pkg[0].duration_days - 1), packageId, range.start, range.end]
  );

  return {
    package_id: pkg[0].id,
    package_title: pkg[0].title,
    duration_days: pkg[0].duration_days,
    month: range.month,
    days: rows.map((row) => {
      const seatsAvailable = Math.max(0, Number(row.seats_available));
      return {
        date: row.date,
        end_date: row.end_date,
        departure_id: row.departure_id,
        seats_total: row.seats_total,
        seats_available: seatsAvailable,
        status: departureStatus({ isPast: Boolean(row.is_past), seatsAvailable, seatsTotal: row.seats_total }),
      };
    }),
  };
}

// The customer's own bookings whose trip starts in the given month.
async function getCustomerCalendar(customerId, range) {
  const [rows] = await pool.execute(
    `SELECT b.id AS booking_id, b.status, b.num_guests,
            DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS date,
            DATE_FORMAT(DATE_ADD(pd.start_date, INTERVAL (p.duration_days - 1) DAY), '%Y-%m-%d') AS end_date,
            p.id AS package_id, p.title AS package_title, d.name AS destination_name
       FROM bookings b
       JOIN package_departures pd ON pd.id = b.departure_id
       JOIN packages p ON p.id = pd.package_id
       JOIN destinations d ON d.id = p.destination_id
      WHERE b.customer_id = ? AND pd.start_date BETWEEN ? AND ?
      ORDER BY pd.start_date, b.id`,
    [customerId, range.start, range.end]
  );
  return { month: range.month, bookings: rows };
}

module.exports = { getPackageCalendar, getCustomerCalendar, departureStatus };
