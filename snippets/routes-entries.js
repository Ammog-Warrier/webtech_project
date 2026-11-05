// Add inside the existing routes object in backend/routes/index.js
'GET /api/admin/categories': requireRole(
  ['ADMIN', 'SUPER_ADMIN'],
  getAdminCategories
),

'GET /api/admin/categories/:id': requireRole(
  ['ADMIN', 'SUPER_ADMIN'],
  getAdminCategoryDetails
),

'POST /api/admin/categories': requireRole(
  ['ADMIN', 'SUPER_ADMIN'],
  createAdminCategory
),

'PUT /api/admin/categories/:id': requireRole(
  ['ADMIN', 'SUPER_ADMIN'],
  updateAdminCategory
),

'DELETE /api/admin/categories/:id': requireRole(
  ['ADMIN', 'SUPER_ADMIN'],
  deleteAdminCategory
),
