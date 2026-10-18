// Finds a handler in the route table. Exact keys win; otherwise ':name' segments match
// one path segment and are returned in params (e.g. 'GET /api/packages/:id').
function matchRoute(routes, method, pathname) {
  const exact = routes[`${method} ${pathname}`];
  if (exact) return { handler: exact, params: {} };

  const parts = pathname.split('/');
  for (const key of Object.keys(routes)) {
    const [routeMethod, routePath] = key.split(' ');
    if (routeMethod !== method || !routePath.includes(':')) continue;
    const routeParts = routePath.split('/');
    if (routeParts.length !== parts.length) continue;
    const params = {};
    const matches = routeParts.every((segment, i) => {
      if (!segment.startsWith(':')) return segment === parts[i];
      params[segment.slice(1)] = decodeURIComponent(parts[i]);
      return true;
    });
    if (matches) return { handler: routes[key], params };
  }
  return null;
}

module.exports = { matchRoute };
