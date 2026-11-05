const { ok, fail } = require('../utils/response');
const { parseMonthParam } = require('../utils/dates');
const { getPackageCalendar, getCustomerCalendar } = require('../services/calendarService');

function monthFrom(req) {
  return parseMonthParam(new URL(req.url, 'http://localhost').searchParams.get('month'));
}

async function packageCalendar(req, res) {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    return fail(res, 400, 'Package id must be a positive integer');
  }
  try {
    return ok(res, await getPackageCalendar(Number(req.params.id), monthFrom(req)));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load calendar');
  }
}

async function myCalendar(req, res) {
  try {
    return ok(res, await getCustomerCalendar(req.user.id, monthFrom(req)));
  } catch (err) {
    return fail(res, err.status || 500, err.status ? err.message : 'Unable to load calendar');
  }
}

module.exports = { packageCalendar, myCalendar };
