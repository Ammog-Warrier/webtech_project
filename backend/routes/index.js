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
const { requireAuth, requireRole } = require('../middleware/auth');

// Route table: 'METHOD /path' -> async handler(req, res)
const routes = {
  // Public
  'GET /api/health': getHealth,
  'GET /api/destinations': getDestinations,
  'GET /api/packages': getPackages,
  'GET /api/packages/:id': getPackage,
  'GET /api/packages/:id/departures': getPackageDepartures,
  'POST /api/auth/register': register,
  'POST /api/auth/login': login,

  // Authenticated (any active user)
  'GET /api/auth/me': requireAuth(getMe),
  'GET /api/users/profile': requireAuth(getProfile),
  'PUT /api/users/profile': requireAuth(updateProfile),

  // Customer role only
  'POST /api/bookings': requireRole('CUSTOMER', createNewBooking),
  'GET /api/bookings/my': requireRole('CUSTOMER', getMyBookings),
  'POST /api/bookings/:id/cancel': requireRole('CUSTOMER', cancelMyBooking),
  'POST /api/bookings/:id/pay': requireRole('CUSTOMER', payForBooking),
  'POST /api/bookings/:id/review': requireRole('CUSTOMER', reviewMyBooking),
};

module.exports = routes;
