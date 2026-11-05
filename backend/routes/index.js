
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

const {
  requireAuth,
  requireRole,
  requireApprovedProvider,
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
  'GET /api/admin/customers': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    getAdminCustomers
  ),

  'GET /api/admin/customers/:id': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    getAdminCustomerDetails
  ),

  'PATCH /api/admin/customers/:id/status': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    updateAdminCustomerStatus
  ),

  // Admin provider management
  'GET /api/admin/providers': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    getAdminProviders
  ),

  'GET /api/admin/providers/:id': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    getAdminProviderDetails
  ),

  'PATCH /api/admin/providers/:id/status': requireRole(
    ['ADMIN', 'SUPER_ADMIN'],
    updateAdminProviderStatus
  ),

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
