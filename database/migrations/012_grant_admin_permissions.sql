-- Migration 012: admin routes now require permissions (see backend/utils/permissions.js).
-- Give every existing ADMIN account all permissions so nobody loses access; a super admin can then
-- narrow them down. Safe to re-run (existing grants are skipped).
USE local_tourism;

INSERT IGNORE INTO admin_permissions (admin_id, permission)
SELECT u.id, p.permission
  FROM users u
  JOIN roles r ON r.id = u.role_id
  CROSS JOIN (
    SELECT 'MANAGE_CUSTOMERS' AS permission
    UNION ALL SELECT 'MANAGE_PROVIDERS'
    UNION ALL SELECT 'MODERATE_PACKAGES'
    UNION ALL SELECT 'MANAGE_CATALOGUE'
    UNION ALL SELECT 'VIEW_BOOKINGS'
    UNION ALL SELECT 'VIEW_REPORTS'
  ) p
 WHERE r.name = 'ADMIN';
