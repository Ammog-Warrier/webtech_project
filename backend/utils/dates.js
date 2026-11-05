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

module.exports = { parseDateParam, parseDateRange };
