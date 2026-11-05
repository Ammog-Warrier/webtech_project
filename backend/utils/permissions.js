// Permissions an ADMIN account can be granted by a super admin (stored in admin_permissions).
// SUPER_ADMIN always has every permission. The admin dashboard needs no permission.
const PERMISSIONS = {
  MANAGE_CUSTOMERS: 'View customers and block or unblock them',
  MANAGE_PROVIDERS: 'View providers; approve, reject, block or unblock them',
  MODERATE_PACKAGES: 'View packages and approve or reject them',
  MANAGE_CATALOGUE: 'Create, edit and delete destinations and categories',
  VIEW_BOOKINGS: 'Monitor all bookings and payments',
  VIEW_REPORTS: 'View platform reports',
};

const PERMISSION_NAMES = Object.keys(PERMISSIONS);

module.exports = { PERMISSIONS, PERMISSION_NAMES };
