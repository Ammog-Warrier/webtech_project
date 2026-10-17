const { ok } = require('../utils/response');
const { testConnection } = require('../config/db');

async function getHealth(req, res) {
  const dbUp = await testConnection();
  ok(res, { status: 'ok', database: dbUp ? 'connected' : 'unavailable', time: new Date().toISOString() });
}

module.exports = { getHealth };
