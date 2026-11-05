const { pool } = require('../config/db');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function normalizeDeparture(body) {
  let startDate = typeof body.start_date === 'string'
    ? body.start_date.trim()
    : '';

  // Accept both YYYY-MM-DD and DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(startDate)) {
    const [day, month, year] = startDate.split('/');
    startDate = `${year}-${month}-${day}`;
  }

  const seatsTotal = Number(body.seats_total);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw httpError(400, 'Select a valid departure date');
  }

  const [year, month, day] = startDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw httpError(400, 'Select a valid departure date');
  }

  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });

  if (startDate < today) {
    throw httpError(400, 'Departure date cannot be in the past');
  }

  if (!Number.isInteger(seatsTotal) || seatsTotal < 1 || seatsTotal > 65535) {
    throw httpError(400, 'Available seats must be between 1 and 65535');
  }

  return { startDate, seatsTotal };
}

async function listProviderDepartures(providerId) {
  const [rows] = await pool.execute(
    `SELECT pd.id, pd.package_id, p.title AS package_title, pd.start_date,
            pd.seats_total,
            COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS booked_seats
       FROM package_departures pd
       JOIN packages p ON p.id = pd.package_id
       LEFT JOIN bookings b ON b.departure_id = pd.id
      WHERE p.provider_id = ?
      GROUP BY pd.id, pd.package_id, p.title, pd.start_date, pd.seats_total
      ORDER BY pd.start_date ASC, pd.id ASC`,
    [providerId]
  );
  return rows.map((row) => ({
    ...row,
    seats_total: Number(row.seats_total),
    booked_seats: Number(row.booked_seats),
    seats_available: Math.max(0, Number(row.seats_total) - Number(row.booked_seats)),
    start_date: row.start_date instanceof Date
    ? `${row.start_date.getFullYear()}-${String(row.start_date.getMonth() + 1).padStart(2, '0')}-${String(row.start_date.getDate()).padStart(2, '0')}`
    : String(row.start_date).slice(0, 10),
  }));
}

async function listProviderApprovedPackages(providerId) {
  const [rows] = await pool.execute(
    `SELECT id, title FROM packages
      WHERE provider_id = ? AND status = 'APPROVED'
      ORDER BY title`,
    [providerId]
  );
  return rows;
}

async function createProviderDeparture(providerId, body) {
  const packageId = Number(body.package_id);
  if (!Number.isInteger(packageId) || packageId < 1) {
    throw httpError(400, 'Select a valid package');
  }
  const input = normalizeDeparture(body);
  const [owned] = await pool.execute(
    `SELECT id FROM packages
      WHERE id = ? AND provider_id = ? AND status = 'APPROVED'`,
    [packageId, providerId]
  );
  if (!owned.length) throw httpError(404, 'Approved package not found');
  const [result] = await pool.execute(
    `INSERT INTO package_departures (package_id, start_date, seats_total)
     VALUES (?, ?, ?)`,
    [packageId, input.startDate, input.seatsTotal]
  );
  return { id: result.insertId, package_id: packageId, start_date: input.startDate, seats_total: input.seatsTotal };
}

async function updateProviderDeparture(providerId, departureId, body) {
  const input = normalizeDeparture(body);
  const [existingRows] = await pool.execute(
    `SELECT pd.id, pd.package_id, pd.seats_total,
            COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS booked_seats
       FROM package_departures pd
       JOIN packages p ON p.id = pd.package_id
       LEFT JOIN bookings b ON b.departure_id = pd.id
      WHERE pd.id = ? AND p.provider_id = ?
      GROUP BY pd.id, pd.package_id, pd.seats_total`,
    [departureId, providerId]
  );
  if (!existingRows.length) return null;
  if (input.seatsTotal < Number(existingRows[0].booked_seats)) {
    throw httpError(400, `Seats cannot be lower than the ${existingRows[0].booked_seats} already booked`);
  }
  const [duplicateRows] = await pool.execute(
  `SELECT id FROM package_departures
   WHERE package_id = ?
     AND start_date = ?
     AND id <> ?
   LIMIT 1`,
  [existingRows[0].package_id, input.startDate, departureId]
);

if (duplicateRows.length) {
  throw httpError(409, 'This package already has a departure scheduled for that date');
}
  await pool.execute(
    `UPDATE package_departures pd
       JOIN packages p ON p.id = pd.package_id
        SET pd.start_date = ?, pd.seats_total = ?
      WHERE pd.id = ? AND p.provider_id = ?`,
    [input.startDate, input.seatsTotal, departureId, providerId]
  );
  return { id: departureId, package_id: existingRows[0].package_id, start_date: input.startDate, seats_total: input.seatsTotal };
}

async function deleteProviderDeparture(providerId, departureId) {
  const [rows] = await pool.execute(
    `SELECT pd.id,
            COUNT(b.id) AS booking_count
       FROM package_departures pd
       JOIN packages p ON p.id = pd.package_id
       LEFT JOIN bookings b ON b.departure_id = pd.id
      WHERE pd.id = ? AND p.provider_id = ?
      GROUP BY pd.id`,
    [departureId, providerId]
  );
  if (!rows.length) return { notFound: true };
  if (Number(rows[0].booking_count) > 0) {
    throw httpError(409, 'This departure has booking history and cannot be deleted');
  }
  await pool.execute(
    `DELETE pd FROM package_departures pd
       JOIN packages p ON p.id = pd.package_id
      WHERE pd.id = ? AND p.provider_id = ?`,
    [departureId, providerId]
  );
  return { deleted: true };
}

module.exports = {
  listProviderDepartures,
  listProviderApprovedPackages,
  createProviderDeparture,
  updateProviderDeparture,
  deleteProviderDeparture,
};
