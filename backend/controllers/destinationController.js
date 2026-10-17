const { ok } = require('../utils/response');
const { listDestinations } = require('../services/destinationService');

async function getDestinations(req, res) {
  ok(res, await listDestinations());
}

module.exports = { getDestinations };
