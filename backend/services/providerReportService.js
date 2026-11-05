const { pool } = require('../config/db');

function dateRange(from, to) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
    const error = new Error('Dates must use YYYY-MM-DD format.');
    error.status = 400;
    throw error;
  }
  if (from && to && from > to) {
    const error = new Error('Start date cannot be after end date.');
    error.status = 400;
    throw error;
  }
  return { from: from || null, to: to || null };
}

function dateConditions(column, range, params) {
  let sql = '';
  if (range.from) {
    sql += ` AND ${column} >= ?`;
    params.push(range.from);
  }
  if (range.to) {
    sql += ` AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(range.to);
  }
  return sql;
}

/** Returns reporting data scoped exclusively to packages owned by providerId. */
async function getProviderReports(providerId, from, to) {
  const range = dateRange(from, to);

  const bookingParams = [providerId];
  const bookingDateSql = dateConditions('b.created_at', range, bookingParams);
  const [summaryRows] = await pool.execute(
    `SELECT COUNT(*) AS total_bookings,
            SUM(CASE WHEN b.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_bookings,
            SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_bookings,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
            COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS guests
     FROM bookings b
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?${bookingDateSql}`,
    bookingParams
  );

  const paymentParams = [providerId];
  const paymentDateSql = dateConditions('pay.paid_at', range, paymentParams);
  const [revenueRows] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END), 0) AS paid_total,
       COALESCE(SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END), 0) AS refunded_total,
       COUNT(*) AS payment_count
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?${paymentDateSql}`,
    paymentParams
  );

  const monthBookingParams = [providerId];
  const monthBookingDateSql = dateConditions('b.created_at', range, monthBookingParams);
  const [bookingMonths] = await pool.execute(
    `SELECT DATE_FORMAT(b.created_at, '%Y-%m') AS month,
            COUNT(*) AS bookings,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled
     FROM bookings b
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?${monthBookingDateSql}
     GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
     ORDER BY month`,
    monthBookingParams
  );

  const monthPaymentParams = [providerId];
  const monthPaymentDateSql = dateConditions('pay.paid_at', range, monthPaymentParams);
  const [paymentMonths] = await pool.execute(
    `SELECT DATE_FORMAT(pay.paid_at, '%Y-%m') AS month,
            SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END) AS paid,
            SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END) AS refunded
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     JOIN package_departures pd ON pd.id = b.departure_id
     JOIN packages p ON p.id = pd.package_id
     WHERE p.provider_id = ?${monthPaymentDateSql}
     GROUP BY DATE_FORMAT(pay.paid_at, '%Y-%m')
     ORDER BY month`,
    monthPaymentParams
  );

  const monthMap = new Map();
  for (const row of bookingMonths) {
    monthMap.set(row.month, {
      month: row.month,
      bookings: Number(row.bookings),
      completed: Number(row.completed || 0),
      cancelled: Number(row.cancelled || 0),
      paid: 0,
      refunded: 0,
    });
  }
  for (const row of paymentMonths) {
    const item = monthMap.get(row.month) || {
      month: row.month, bookings: 0, completed: 0, cancelled: 0, paid: 0, refunded: 0,
    };
    item.paid = Number(row.paid || 0);
    item.refunded = Number(row.refunded || 0);
    monthMap.set(row.month, item);
  }

  const packageBookingParams = [providerId];
  const packageBookingDateSql = dateConditions('b.created_at', range, packageBookingParams);
  const [packageRows] = await pool.execute(
    `SELECT p.id AS package_id, p.title AS package_title,
            COUNT(b.id) AS bookings,
            COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS guests,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled
     FROM packages p
     LEFT JOIN package_departures pd ON pd.package_id = p.id
     LEFT JOIN bookings b ON b.departure_id = pd.id${packageBookingDateSql}
     WHERE p.provider_id = ?
     GROUP BY p.id, p.title
     ORDER BY bookings DESC, p.title`,
    // The date condition belongs in the LEFT JOIN; parameters must follow providerId.
    packageBookingParams.slice(1).concat([providerId])
  );

  const packagePaymentParams = [providerId];
  const packagePaymentDateSql = dateConditions('pay.paid_at', range, packagePaymentParams);
  const [packageRevenueRows] = await pool.execute(
    `SELECT p.id AS package_id,
            COALESCE(SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END), 0) AS paid,
            COALESCE(SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END), 0) AS refunded
     FROM packages p
     LEFT JOIN package_departures pd ON pd.package_id = p.id
     LEFT JOIN bookings b ON b.departure_id = pd.id
     LEFT JOIN payments pay ON pay.booking_id = b.id${packagePaymentDateSql}
     WHERE p.provider_id = ?
     GROUP BY p.id`,
    packagePaymentParams.slice(1).concat([providerId])
  );

  const revenueByPackage = new Map(packageRevenueRows.map((row) => [
    Number(row.package_id), { paid: Number(row.paid), refunded: Number(row.refunded) },
  ]));

  const departureParams = [providerId];
  const departureDateSql = dateConditions('pd.start_date', range, departureParams);
  const [departureRows] = await pool.execute(
    `SELECT pd.id AS departure_id,
       DATE_FORMAT(pd.start_date, '%Y-%m-%d') AS start_date,
       pd.seats_total,
            p.id AS package_id, p.title AS package_title,
            COALESCE(SUM(CASE WHEN b.status IN ('PENDING','CONFIRMED','COMPLETED') THEN b.num_guests ELSE 0 END), 0) AS seats_booked
     FROM package_departures pd
     JOIN packages p ON p.id = pd.package_id
     LEFT JOIN bookings b ON b.departure_id = pd.id
     WHERE p.provider_id = ?${departureDateSql}
     GROUP BY pd.id, pd.start_date, pd.seats_total, p.id, p.title
     ORDER BY pd.start_date DESC`,
    departureParams
  );

  const summary = summaryRows[0];
  const paid = Number(revenueRows[0].paid_total);
  const refunded = Number(revenueRows[0].refunded_total);

  return {
    filters: range,
    summary: {
      total_bookings: Number(summary.total_bookings || 0),
      pending_bookings: Number(summary.pending_bookings || 0),
      confirmed_bookings: Number(summary.confirmed_bookings || 0),
      completed_bookings: Number(summary.completed_bookings || 0),
      cancelled_bookings: Number(summary.cancelled_bookings || 0),
      guests: Number(summary.guests || 0),
      paid_total: paid,
      refunded_total: refunded,
      net_total: paid - refunded,
      payment_count: Number(revenueRows[0].payment_count || 0),
    },
    monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    packages: packageRows.map((row) => {
      const revenue = revenueByPackage.get(Number(row.package_id)) || { paid: 0, refunded: 0 };
      return {
        package_id: Number(row.package_id),
        package_title: row.package_title,
        bookings: Number(row.bookings || 0),
        guests: Number(row.guests || 0),
        completed: Number(row.completed || 0),
        cancelled: Number(row.cancelled || 0),
        paid: revenue.paid,
        refunded: revenue.refunded,
        net: revenue.paid - revenue.refunded,
      };
    }),
    departures: departureRows.map((row) => {
      const total = Number(row.seats_total);
      const booked = Number(row.seats_booked);
      return {
        departure_id: Number(row.departure_id),
        package_title: row.package_title,
        start_date: row.start_date,
        seats_total: total,
        seats_booked: booked,
        seats_available: Math.max(0, total - booked),
        occupancy_percent: total > 0 ? Math.round((booked / total) * 100) : 0,
      };
    }),
  };
}

module.exports = { getProviderReports };
