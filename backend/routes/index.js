const { getHealth } = require('../controllers/healthController');

// Route table: 'METHOD /path' -> async handler(req, res)
// Add new feature routes here (or in a separate file spread into this object).
const routes = {
  'GET /api/health': getHealth,
};

module.exports = routes;
