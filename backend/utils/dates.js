// Validates a YYYY-MM-DD query parameter. Returns null when empty, throws a 400 error when invalid.
function parseDateParam(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(text)
    && !Number.isNaN(Date.parse(`${text}T00:00:00Z`))
    && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
  if (!valid) {
    throw Object.assign(new Error(`${name} must be a valid date (YYYY-MM-DD)`), { status: 400 });
  }
  return text;
}

// Validates a from/to pair; throws 400 when from is after to.
function parseDateRange(fromValue, toValue) {
  const from = parseDateParam(fromValue, 'from');
  const to = parseDateParam(toValue, 'to');
  if (from && to && from > to) {
    throw Object.assign(new Error('from must not be after to'), { status: 400 });
  }
  return { from, to };
}

// Validates a YYYY-MM query parameter (defaults to the current month).
// Returns { month: 'YYYY-MM', start: 'YYYY-MM-01', end: 'YYYY-MM-<last day>' }; throws a 400 error when invalid.
function parseMonthParam(value) {
  let month = value === null || value === undefined || value === '' ? null : String(value).trim();
  if (month === null) {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw Object.assign(new Error('month must use the format YYYY-MM'), { status: 400 });
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { month, start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

module.exports = { parseDateParam, parseDateRange, parseMonthParam };
