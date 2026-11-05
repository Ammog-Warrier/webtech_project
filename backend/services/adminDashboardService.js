const { pool } = require('../config/db');

async function getAdminDashboard() {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'CUSTOMER') AS total_customers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'CUSTOMER' AND u.is_active = 1) AS active_customers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'CUSTOMER' AND u.is_active = 0) AS blocked_customers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'PROVIDER') AS total_providers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'PROVIDER' AND u.provider_status = 'PENDING') AS pending_providers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'PROVIDER' AND u.provider_status = 'APPROVED' AND u.is_active = 1) AS approved_providers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'PROVIDER' AND u.provider_status = 'REJECTED') AS rejected_providers,
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'PROVIDER' AND u.is_active = 0) AS blocked_providers,
       (SELECT COUNT(*) FROM packages) AS total_packages,
       (SELECT COUNT(*) FROM packages WHERE status = 'PENDING') AS pending_packages,
       (SELECT COUNT(*) FROM packages WHERE status = 'APPROVED') AS approved_packages,
       (SELECT COUNT(*) FROM destinations) AS total_destinations,
       (SELECT COUNT(*) FROM categories) AS total_categories,
       (SELECT COUNT(*) FROM bookings) AS total_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'PENDING') AS pending_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED') AS confirmed_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED') AS completed_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED') AS cancelled_bookings,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'PAID') AS paid_revenue,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'REFUNDED') AS refunded_amount,
       (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) AS registrations_today,
       (SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURDATE()) AS bookings_today`
  );

  const row = rows[0];
  const numericFields = [
    'total_customers', 'active_customers', 'blocked_customers',
    'total_providers', 'pending_providers', 'approved_providers',
    'rejected_providers', 'blocked_providers', 'total_packages',
    'pending_packages', 'approved_packages', 'total_destinations',
    'total_categories', 'total_bookings', 'pending_bookings',
    'confirmed_bookings', 'completed_bookings', 'cancelled_bookings',
    'paid_revenue', 'refunded_amount', 'registrations_today', 'bookings_today',
  ];

  for (const field of numericFields) row[field] = Number(row[field]);
  row.net_collected = row.paid_revenue - row.refunded_amount;
  return row;
}

module.exports = { getAdminDashboard };
