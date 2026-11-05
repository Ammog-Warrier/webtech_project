// Add this import alongside the other controller imports in backend/routes/index.js:
const {
  getProviders: getAdminProviders,
  getProviderDetails: getAdminProviderDetails,
  updateProviderStatus: updateAdminProviderStatus,
} = require('../controllers/adminProviderController');

// Add these entries inside the existing routes object, near the other /api/admin routes:
'GET /api/admin/providers': requireRole(['ADMIN', 'SUPER_ADMIN'], getAdminProviders),
'GET /api/admin/providers/:id': requireRole(['ADMIN', 'SUPER_ADMIN'], getAdminProviderDetails),
'PATCH /api/admin/providers/:id/status': requireRole(['ADMIN', 'SUPER_ADMIN'], updateAdminProviderStatus),
