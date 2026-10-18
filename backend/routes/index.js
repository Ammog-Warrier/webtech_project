const { getHealth } = require('../controllers/healthController');
const { getDestinations } = require('../controllers/destinationController');
const { getPackages, getPackage } = require('../controllers/packageController');

// Route table: 'METHOD /path' -> async handler(req, res)
// Add new feature routes here (or in a separate file spread into this object).
const routes = {
  'GET /api/health': getHealth,
  'GET /api/destinations': getDestinations,
  'GET /api/packages': getPackages,
  'GET /api/packages/:id': getPackage,
};

module.exports = routes;
