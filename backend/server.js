require('dotenv').config();
const http = require('http');
const routes = require('./routes');
const { serveStatic } = require('./middleware/static');
const { fail } = require('./utils/response');
const { matchRoute } = require('./utils/matchRoute');
const { isBlockedByMaintenance } = require('./middleware/maintenance');
const { testConnection } = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (pathname.startsWith('/api/')) {
      if (await isBlockedByMaintenance(req, pathname)) {
        return fail(res, 503, 'The site is under maintenance. Please try again later.');
      }
      const match = matchRoute(routes, req.method, pathname);
      if (!match) return fail(res, 404, 'API route not found');
      req.params = match.params;
      return await match.handler(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed');
    if (!(await serveStatic(req, res, pathname))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  } catch (err) {
    // Centralized error handling
    console.error(err);
    if (res.headersSent) return res.end();
    fail(res, err.status || 500, err.status ? err.message : 'Internal server error');
  }
});

server.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (await testConnection()) console.log('Database connected');
  else console.warn('Database NOT connected - check .env and MySQL');
});
