// Optional pagination for list endpoints.
// Without ?page and ?limit a list endpoint returns a plain array (unchanged behaviour).
// With either one it returns { items, page, limit, total, total_pages }.
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePositiveInt(raw, name) {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw Object.assign(new Error(`${name} must be a positive integer`), { status: 400 });
  }
  return Number(raw);
}

function parsePaging(searchParams) {
  const rawPage = searchParams.get('page');
  const rawLimit = searchParams.get('limit');
  if (rawPage === null && rawLimit === null) return null;
  const page = rawPage === null ? 1 : parsePositiveInt(rawPage, 'page');
  const limit = rawLimit === null ? DEFAULT_LIMIT : parsePositiveInt(rawLimit, 'limit');
  if (limit > MAX_LIMIT) {
    throw Object.assign(new Error(`limit must be at most ${MAX_LIMIT}`), { status: 400 });
  }
  return { page, limit };
}

// Slices an already loaded list. Fine for the small data sets of this project.
function applyPaging(rows, paging) {
  if (!paging) return rows;
  const total = rows.length;
  const start = (paging.page - 1) * paging.limit;
  return {
    items: rows.slice(start, start + paging.limit),
    page: paging.page,
    limit: paging.limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / paging.limit)),
  };
}

module.exports = { parsePaging, applyPaging };
