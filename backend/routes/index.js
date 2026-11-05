
const { getHealth } = require('../controllers/healthController');
const { getDestinations } = require('../controllers/destinationController');
const { getPackages, getPackage } = require('../controllers/packageController');
const { getPackageDepartures } = require('../controllers/departureController');
const { register, login, getMe } = require('../controllers/authController');

const {
  createNewBooking,
  getMyBookings,
  cancelMyBooking,
  payForBooking,
  reviewMyBooking,
} = require('../controllers/bookingController');

const { getProfile, updateProfile } = require('../controllers/userController');

const {
  getDashboard: getProviderDashboard,
} = require('../controllers/providerController');

const {
  getDashboard: getAdminDashboard,
} = require('../controllers/adminDashboardController');

const {
  getCustomers: getAdminCustomers,
  getCustomerDetails: getAdminCustomerDetails,
  updateCustomerStatus: updateAdminCustomerStatus,
} = require('../controllers/adminCustomerController');

const {
  getProviders: getAdminProviders,
  getProviderDetails: getAdminProviderDetails,
  updateProviderStatus: updateAdminProviderStatus,
} = require('../controllers/adminProviderController');

// Admin destination management
const {
  getDestinations: getAdminDestinations,
  getDestinationDetails: getAdminDestinationDetails,
  createDestination: createAdminDestination,
  updateDestination: updateAdminDestination,
  deleteDestination: deleteAdminDestination,
} = require('../controllers/adminDestinationController');

// Step 4.5: Admin category management
const {
  getAdminCategories,
  getAdminCategoryDetails,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} = require('../controllers/adminCategoryController');

// Admin package moderation
const {
  getPackages: getAdminPackages,
  getPackageDetails: getAdminPackageDetails,
  updatePackageStatus: updateAdminPackageStatus,
} = require('../controllers/adminPackageController');

// Admin booking monitoring (read only)
const {
  getBookings: getAdminBookings,
  getBookingDetails: getAdminBookingDetails,
} = require('../controllers/adminBookingController');

// Admin reports
const { getReport: getAdminReport } = require('../controllers/adminReportController');

// Super admin: admin account management
const {
  getAdmins: getSuperAdminAdmins,
  getAdminDetails: getSuperAdminAdminDetails,
  createAdminAccount,
  updateAdminAccount,
  updateAdminStatus: updateSuperAdminAdminStatus,
  deleteAdminAccount,
} = require('../controllers/superAdminAdminController');

// Super admin: admin permissions
const {
  listPermissions,
  getPermissions: getAdminPermissionList,
  updatePermissions: updateAdminPermissionList,
} = require('../controllers/superAdminPermissionController');

const {
  requireAuth,
  requireRole,
  requireApprovedProvider,
  requirePermission,
} = require('../middleware/auth');

const {
  getMyBookings: getProviderBookings,
  getBookingDetails: getProviderBookingDetails,
  confirmBooking: confirmProviderBooking,
} = require('../controllers/providerBookingController');

const {
  getMyDepartures,
  getDeparturePackages,
  createDeparture,
  updateDeparture,
  deleteDeparture,
} = require('../controllers/providerDepartureController');

const {
  getMyPackages,
  getPackageFormOptions,
  createPackage,
  updatePackage,
  deletePackage,
} = require('../controllers/providerPackageController');

const {
  getMyFinance,
  getMyReviews,
} = require('../controllers/providerFinanceController');

const {
  getMyReports,
} = require('../controllers/providerReportController');

// Route table: 'METHOD /path' -> async handler(req, res)
const routes = {
  // Public routes
  'GET /api/health': getHealth,
  'GET /api/destinations': getDestinations,
  'GET /api/packages': getPackages,
  'GET /api/packages/:id': getPackage,
  'GET /api/packages/:id/departures': getPackageDepartures,

  'POST /api/auth/register': register,
  'POST /api/auth/login': login,

  // Authenticated user routes
  'GET /api/auth/me': requireAuth(getMe),
  'GET /api/users/profile': requireAuth(getProfile),
  'PUT /api/users/profile': requireAuth(updateProfile),

  // Admin dashboard
  'GET /api/admin/dashboard': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    getAdminDashboard
  ),

  // Admin customer management
  'GET /api/admin/customers': requirePermission(
    'MANAGE_CUSTOMERS',
    getAdminCustomers
  ),

  'GET /api/admin/customers/:id': requirePermission(
    'MANAGE_CUSTOMERS',
    getAdminCustomerDetails
  ),

  'PATCH /api/admin/customers/:id/status': requirePermission(
    'MANAGE_CUSTOMERS',
    updateAdminCustomerStatus
  ),

  // Admin provider management
  'GET /api/admin/providers': requirePermission(
    'MANAGE_PROVIDERS',
    getAdminProviders
  ),

  'GET /api/admin/providers/:id': requirePermission(
    'MANAGE_PROVIDERS',
    getAdminProviderDetails
  ),

  'PATCH /api/admin/providers/:id/status': requirePermission(
    'MANAGE_PROVIDERS',
    updateAdminProviderStatus
  ),

  // Admin destination management
  'GET /api/admin/destinations': requirePermission(
    'MANAGE_CATALOGUE',
    getAdminDestinations
  ),

  'GET /api/admin/destinations/:id': requirePermission(
    'MANAGE_CATALOGUE',
    getAdminDestinationDetails
  ),

  'POST /api/admin/destinations': requirePermission(
    'MANAGE_CATALOGUE',
    createAdminDestination
  ),

  'PUT /api/admin/destinations/:id': requirePermission(
    'MANAGE_CATALOGUE',
    updateAdminDestination
  ),

  'DELETE /api/admin/destinations/:id': requirePermission(
    'MANAGE_CATALOGUE',
    deleteAdminDestination
  ),

  // Admin category management
  'GET /api/admin/categories': requirePermission(
    'MANAGE_CATALOGUE',
    getAdminCategories
  ),

  'GET /api/admin/categories/:id': requirePermission(
    'MANAGE_CATALOGUE',
    getAdminCategoryDetails
  ),

  'POST /api/admin/categories': requirePermission(
    'MANAGE_CATALOGUE',
    createAdminCategory
  ),

  'PUT /api/admin/categories/:id': requirePermission(
    'MANAGE_CATALOGUE',
    updateAdminCategory
  ),

  'DELETE /api/admin/categories/:id': requirePermission(
    'MANAGE_CATALOGUE',
    deleteAdminCategory
  ),

  // Admin package moderation
  'GET /api/admin/packages': requirePermission(
    'MODERATE_PACKAGES',
    getAdminPackages
  ),

  'GET /api/admin/packages/:id': requirePermission(
    'MODERATE_PACKAGES',
    getAdminPackageDetails
  ),

  'PATCH /api/admin/packages/:id/status': requirePermission(
    'MODERATE_PACKAGES',
    updateAdminPackageStatus
  ),

  // Admin booking monitoring
  'GET /api/admin/bookings': requirePermission(
    'VIEW_BOOKINGS',
    getAdminBookings
  ),

  'GET /api/admin/bookings/:id': requirePermission(
    'VIEW_BOOKINGS',
    getAdminBookingDetails
  ),

  // Admin reports
  'GET /api/admin/reports': requirePermission(
    'VIEW_REPORTS',
    getAdminReport
  ),

  // Super admin: admin account management
  'GET /api/superadmin/admins': requireRole('SUPER_ADMIN', getSuperAdminAdmins),
  'POST /api/superadmin/admins': requireRole('SUPER_ADMIN', createAdminAccount),
  'GET /api/superadmin/admins/:id': requireRole('SUPER_ADMIN', getSuperAdminAdminDetails),
  'PUT /api/superadmin/admins/:id': requireRole('SUPER_ADMIN', updateAdminAccount),
  'PATCH /api/superadmin/admins/:id/status': requireRole('SUPER_ADMIN', updateSuperAdminAdminStatus),
  'DELETE /api/superadmin/admins/:id': requireRole('SUPER_ADMIN', deleteAdminAccount),

  // Super admin: admin permissions
  'GET /api/superadmin/permissions': requireRole('SUPER_ADMIN', listPermissions),
  'GET /api/superadmin/admins/:id/permissions': requireRole('SUPER_ADMIN', getAdminPermissionList),
  'PUT /api/superadmin/admins/:id/permissions': requireRole('SUPER_ADMIN', updateAdminPermissionList),

  // Provider dashboard
  'GET /api/provider/dashboard': requireRole(
    'PROVIDER',
    getProviderDashboard
  ),

  // Provider package management
  'GET /api/provider/package-options': requireApprovedProvider(
    getPackageFormOptions
  ),

  'GET /api/provider/packages': requireApprovedProvider(getMyPackages),
  'POST /api/provider/packages': requireApprovedProvider(createPackage),

  'PUT /api/provider/packages/:id': requireApprovedProvider(
    updatePackage
  ),

  'DELETE /api/provider/packages/:id': requireApprovedProvider(
    deletePackage
  ),

  // Provider departure management
  'GET /api/provider/departure-packages': requireApprovedProvider(
    getDeparturePackages
  ),

  'GET /api/provider/departures': requireApprovedProvider(getMyDepartures),
  'POST /api/provider/departures': requireApprovedProvider(createDeparture),

  'PUT /api/provider/departures/:id': requireApprovedProvider(
    updateDeparture
  ),

  'DELETE /api/provider/departures/:id': requireApprovedProvider(
    deleteDeparture
  ),

  // Provider booking management
  'GET /api/provider/bookings': requireApprovedProvider(
    getProviderBookings
  ),

  'GET /api/provider/bookings/:id': requireApprovedProvider(
    getProviderBookingDetails
  ),

  'POST /api/provider/bookings/:id/confirm': requireApprovedProvider(
    confirmProviderBooking
  ),

  // Provider earnings and reviews
  'GET /api/provider/finance': requireApprovedProvider(getMyFinance),
  'GET /api/provider/reviews': requireApprovedProvider(getMyReviews),

  // Provider business reports
  'GET /api/provider/reports': requireApprovedProvider(getMyReports),

  // Customer booking management
  'POST /api/bookings': requireRole('CUSTOMER', createNewBooking),
  'GET /api/bookings/my': requireRole('CUSTOMER', getMyBookings),

  'POST /api/bookings/:id/cancel': requireRole(
    'CUSTOMER',
    cancelMyBooking
  ),

  'POST /api/bookings/:id/pay': requireRole(
    'CUSTOMER',
    payForBooking
  ),

  'POST /api/bookings/:id/review': requireRole(
    'CUSTOMER',
    reviewMyBooking
  ),
};

module.exports = routes;
