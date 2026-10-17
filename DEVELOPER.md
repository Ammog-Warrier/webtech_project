# Developer Guide

Living document. **Update it in the same pull request whenever you add or change an endpoint, table, env variable, script or setup step.**

## Database setup
Each collaborator uses their own local database and `.env` (never commit `.env`). After pulling the repo:

1. Install Node.js 18+ and MySQL 8 or MariaDB, and make sure the server is running.
2. `npm install`, then copy `.env.example` to `.env` and choose your own `DB_PASSWORD`.
3. **One-time, as a DB admin (root):** run `database/schema.sql` (creates the database and all tables), then create the app user from your `.env` values, limited to this database:
   ```sql
   CREATE USER IF NOT EXISTS 'tourism_user'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';
   GRANT ALL PRIVILEGES ON local_tourism.* TO 'tourism_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
4. Load the seed data: run `database/seed.sql` (safe to re-run; it won't duplicate rows).
5. `npm start` should print "Database connected"; `/api/health` should report `"database":"connected"`.

**Already set up and pulled new changes?** Run the new file(s) in `database/migrations/` (as `tourism_user`, no admin needed), then `database/seed.sql` again. Example with the MariaDB/MySQL CLI: `mysql -u tourism_user -p local_tourism < database/migrations/001_destinations_packages.sql`.

Rule: every schema change = a new numbered migration **and** the same change in `schema.sql`.

## Environment variables (`.env`)
| Variable | Purpose | Default in `.env.example` |
|---|---|---|
| PORT | HTTP port | 3000 |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 3306 |
| DB_USER | Application DB user | tourism_user |
| DB_PASSWORD | Application DB password | change_me |
| DB_NAME | Database name | local_tourism |

## npm scripts
| Script | Description |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with nodemon (auto-reload) |

## API endpoints
Responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/health | Public | Server and database status |
| GET | /api/destinations | Public | All destinations (`id, name, description, image_url`) |
| GET | /api/packages | Public | All packages with `destination_name`; optional `?destination_id=<int>` (400 if not an integer) |

## Database tables
| Table | Notes |
|---|---|
| roles | CUSTOMER, PROVIDER, ADMIN, SUPER_ADMIN (seeded) |
| users | `role_id` FK to roles; `password_hash` (bcryptjs) |
| destinations | `name` unique, `description`, `image_url` (seeded: Mountains, Beaches, Cities) |
| packages | `destination_id` FK, `title` unique, `price`, `duration_days`, `image_url` (6 seeded) |

Schema changes: add `database/migrations/NNN_description.sql` and update `schema.sql`.

## Adding a feature
1. Service in `backend/services/` (SQL, parameterized).
2. Controller in `backend/controllers/`.
3. Register `'METHOD /api/path'` in `backend/routes/index.js`.
4. Update this file (endpoints, tables, env vars).

## Frontend pages
| Page | Status |
|---|---|
| index | Landing page (static content) |
| destinations | Working: lists destinations from the API, links to filtered packages |
| packages | Working: lists packages, filter by destination |
| login, register | Placeholders |

Frontend helpers: `js/api.js` (fetch wrapper), `js/render.js` (safe DOM builders). Images live in `frontend/assets/img/` (served locally; no hotlinking).

## Conventions
**Technology (strict):** only HTML5, CSS3, vanilla JS, Node built-ins (`http`), MySQL/MariaDB with `mysql2`, plus `dotenv`, `bcryptjs`, `nodemon` (dev). No frameworks (Express, React, Vue, Angular, Next.js, Bootstrap, Tailwind) and no ORMs. Ask the team before adding any dependency.

**Code:** CommonJS and async/await in the backend; plain scripts in the frontend. 2-space indent, single quotes, semicolons, camelCase. Style through CSS variables in `frontend/css/style.css`. Don't build UI that looks working but isn't.

**Layers:** routes (`backend/routes/index.js`) -> controllers (HTTP only) -> services (business logic + SQL). Auth and role checks go in `backend/middleware/`.

**Database:** plural snake_case tables, snake_case columns, PK `id`, FKs named `<entity>_id` with constraints. Parameterized queries only (`pool.execute(sql, [params])`).

**API:** use `ok()` / `fail()` from `backend/utils/response.js`. Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error. Routes under `/api`, plural nouns.

**Security:** no credentials in code, `.env` stays untracked, hash passwords with bcryptjs and never return hashes, validate input server-side, enforce roles in the backend, use `textContent` (not `innerHTML`) for user content, app connects with the limited DB user (never root).

**Git:** feature branches, small commits, pull requests reviewed by a teammate, never commit `.env`.

## Changelog
- 2026-10-17: Destinations and packages (tables, migration 001, seed, list endpoints, pages, local images).
- 2026-10-17: Initial foundation (server, static serving, health endpoint, DB pool, roles/users schema).
