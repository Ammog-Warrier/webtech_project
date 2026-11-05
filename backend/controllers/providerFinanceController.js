const { ok } = require('../utils/response');
const { getProviderFinance, listProviderReviews } = require('../services/providerFinanceService');

async function getMyFinance(req, res) {
  ok(res, await getProviderFinance(req.user.id));
}

async function getMyReviews(req, res) {
  ok(res, await listProviderReviews(req.user.id));
}

module.exports = { getMyFinance, getMyReviews };
