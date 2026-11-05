const { logAction } = require('../services/auditService');
const { ok, fail } = require('../utils/response');
const { parseJsonBody } = require('../utils/body');
const { parsePaging, applyPaging } = require('../utils/pagination');
const {
  listCustomers,
  getCustomer,
  setCustomerActiveStatus,
} = require('../services/adminCustomerService');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

async function getCustomers(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const paging = parsePaging(url.searchParams);
    const customers = await listCustomers({
      search: url.searchParams.get('search') || '',
      status: url.searchParams.get('status') || '',
    });
    ok(res, applyPaging(customers, paging));
  } catch (err) {
    fail(res, err.status || 500, err.message || 'Unable to load customers');
  }
}

async function getCustomerDetails(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Customer id must be a positive integer');
  try {
    const customer = await getCustomer(Number(req.params.id));
    if (!customer) return fail(res, 404, 'Customer not found');
    ok(res, customer);
  } catch (err) {
    fail(res, err.status || 500, err.message || 'Unable to load customer');
  }
}

async function updateCustomerStatus(req, res) {
  if (!validId(req.params.id)) return fail(res, 400, 'Customer id must be a positive integer');
  const body = await parseJsonBody(req);
  if (!body || typeof body.is_active !== 'boolean') {
    return fail(res, 400, 'is_active must be a boolean');
  }
  try {
    const customer = await setCustomerActiveStatus(Number(req.params.id), body.is_active);
    await logAction(req.user.id, body.is_active ? 'CUSTOMER_UNBLOCKED' : 'CUSTOMER_BLOCKED', 'users', customer.id, customer.email);
    ok(res, customer);
  } catch (err) {
    fail(res, err.status || 500, err.message || 'Unable to update customer status');
  }
}

module.exports = { getCustomers, getCustomerDetails, updateCustomerStatus };
