const { pool } = require('../config/db');

// Platform-wide report. Every figure in the date range is based on the booking date
// (bookings.created_at), so bookings and the money from them always agree.
// A cancelled booking's payment becomes REFUNDED, so money still held = paid_total.

function rangeSql(range, params) {
  let sql = '';
  if (range.from) {
    sql += ' AND DATE(b.created_at) >= ?';
    params.push(range.from);
  }
  if (range.to) {
    sql += ' AND DATE(b.created_at) <= ?';
    params.push(range.to);
  }
  return sql;
}

const BOOKING_FROM = `FROM bookings b
       JOIN package_departures pd ON pd.id = b.departure_id
       JOIN packages p ON p.id = pd.package_id
       LEFT JOIN payments pay ON pay.booking_id = b.id`;

const PAID = "COALESCE(SUM(CASE WHEN pay.status = 'PAID' THEN pay.amount ELSE 0 END), 0)";
const REFUNDED = "COALESCE(SUM(CASE WHEN pay.status = 'REFUNDED' THEN pay.amount ELSE 0 END), 0)";

async function getAdminReport(range) {
  const run = async (select, tail, extra = '') => {
    const params = [];
    const where = rangeSql(range, params);
    const [rows] = await pool.execute(
      `SELECT ${select} ${BOOKING_FROM} ${extra} WHERE 1 = 1${where} ${tail}`,
      params
    );
    return rows;
  };

  const [summary] = await run(
    `COUNT(b.id) AS total_bookings,
     COALESCE(SUM(b.status = 'PENDING'), 0) AS pending_bookings,
     COALESCE(SUM(b.status = 'CONFIRMED'), 0) AS confirmed_bookings,
     COALESCE(SUM(b.status = 'COMPLETED'), 0) AS completed_bookings,
     COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelled_bookings,
     COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS guests,
     ${PAID} AS paid_total,
     ${REFUNDED} AS refunded_total`,
    ''
  );

  const monthly = await run(
    `DATE_FORMAT(b.created_at, '%Y-%m') AS month,
     COUNT(b.id) AS bookings,
     COALESCE(SUM(b.status = 'CANCELLED'), 0) AS cancelled,
     ${PAID} AS paid,
     ${REFUNDED} AS refunded`,
    "GROUP BY DATE_FORMAT(b.created_at, '%Y-%m') ORDER BY month"
  );

  const topPackages = await run(
    `p.id AS package_id, p.title AS package_title,
     COUNT(b.id) AS bookings,
     COALESCE(SUM(CASE WHEN b.status <> 'CANCELLED' THEN b.num_guests ELSE 0 END), 0) AS guests,
     ${PAID} AS revenue`,
    'GROUP BY p.id, p.title ORDER BY revenue DESC, bookings DESC, p.title LIMIT 5'
  );

  const topProviders = await run(
    `p.provider_id AS provider_id, COALESCE(u.full_name, 'Unassigned') AS provider_name,
     COUNT(b.id) AS bookings,
     ${PAID} AS revenue`,
    'GROUP BY p.provider_id, u.full_name ORDER BY revenue DESC, bookings DESC, provider_name LIMIT 5',
    'LEFT JOIN users u ON u.id = p.provider_id'
  );

  const destinations = await run(
    `d.id AS destination_id, d.name AS destination_name,
     COUNT(b.id) AS bookings,
     ${PAID} AS revenue`,
    'GROUP BY d.id, d.name ORDER BY bookings DESC, d.name',
    'JOIN destinations d ON d.id = p.destination_id'
  );

  const categories = await run(
    `COALESCE(c.name, 'Uncategorised') AS category_name,
     COUNT(b.id) AS bookings,
     ${PAID} AS revenue`,
    'GROUP BY c.id, c.name ORDER BY bookings DESC, category_name',
    'LEFT JOIN categories c ON c.id = p.category_id'
  );

  // Accounts registered in the range (by registration date)
  const userParams = [];
  let userWhere = '';
  if (range.from) {
    userWhere += ' AND DATE(u.created_at) >= ?';
    userParams.push(range.from);
  }
  if (range.to) {
    userWhere += ' AND DATE(u.created_at) <= ?';
    userParams.push(range.to);
  }
  const [[users]] = await Promise.all([pool.execute(
    `SELECT COALESCE(SUM(r.name = 'CUSTOMER'), 0) AS new_customers,
            COALESCE(SUM(r.name = 'PROVIDER'), 0) AS new_providers
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE 1 = 1${userWhere}`,
    userParams
  )]);

  // Catalogue snapshot (not date filtered)
  const [catalogueRows] = await pool.execute(
    'SELECT status, COUNT(*) AS total FROM packages GROUP BY status'
  );
  const catalogue = { PENDING: 0, APPROVED: 0, REJECTED: 0, ARCHIVED: 0 };
  for (const row of catalogueRows) catalogue[row.status] = Number(row.total);

  const num = (value) => Number(value || 0);
  const paid = num(summary.paid_total);
  const refunded = num(summary.refunded_total);

  return {
    filters: { from: range.from, to: range.to },
    summary: {
      total_bookings: num(summary.total_bookings),
      pending_bookings: num(summary.pending_bookings),
      confirmed_bookings: num(summary.confirmed_bookings),
      completed_bookings: num(summary.completed_bookings),
      cancelled_bookings: num(summary.cancelled_bookings),
      guests: num(summary.guests),
      paid_total: paid,
      refunded_total: refunded,
      net_total: paid,
      gross_total: paid + refunded,
      new_customers: num(users[0].new_customers),
      new_providers: num(users[0].new_providers),
    },
    catalogue,
    monthly: monthly.map((r) => ({
      month: r.month, bookings: num(r.bookings), cancelled: num(r.cancelled),
      paid: num(r.paid), refunded: num(r.refunded),
    })),
    top_packages: topPackages.map((r) => ({
      package_id: r.package_id, package_title: r.package_title,
      bookings: num(r.bookings), guests: num(r.guests), revenue: num(r.revenue),
    })),
    top_providers: topProviders.map((r) => ({
      provider_id: r.provider_id, provider_name: r.provider_name,
      bookings: num(r.bookings), revenue: num(r.revenue),
    })),
    destinations: destinations.map((r) => ({
      destination_id: r.destination_id, destination_name: r.destination_name,
      bookings: num(r.bookings), revenue: num(r.revenue),
    })),
    categories: categories.map((r) => ({
      category_name: r.category_name, bookings: num(r.bookings), revenue: num(r.revenue),
    })),
  };
}

module.exports = { getAdminReport };
