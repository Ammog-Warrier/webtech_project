# Developer Guide

Living document. **Update it in the same pull request whenever you add or change an endpoint, table, env variable, script or setup step.**

## Database setup
Each collaborator uses their own local database and `.env` (never commit `.env`).
1. Make sure MySQL/MariaDB is running.
2. As a database admin user, run `database/schema.sql`, then `database/seed.sql`.
3. Create an application user matching `DB_USER` / `DB_PASSWORD` in `.env`, with privileges **only** on `local_tourism`. Do not use root in the app.
4. `npm start` should print "Database connected"; `/api/health` should report `"database":"connected"`.

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

## Database tables
| Table | Notes |
|---|---|
| roles | CUSTOMER, PROVIDER, ADMIN, SUPER_ADMIN (seeded) |
| users | `role_id` FK to roles; `password_hash` (bcryptjs) |

Schema changes: add `database/migrations/NNN_description.sql` and update `schema.sql`.

## Adding a feature
1. Service in `backend/services/` (SQL, parameterized).
2. Controller in `backend/controllers/`.
3. Register `'METHOD /api/path'` in `backend/routes/index.js`.
4. Update this file (endpoints, tables, env vars).

## Frontend pages
| Page | Status |
|---|---|
| index, login, register, destinations, packages | Layout only; login/register/destinations/packages are placeholders |

## Conventions
**Technology (strict):** only HTML5, CSS3, vanilla JS, Node built-ins (`http`), MySQL/MariaDB with `mysql2`, plus `dotenv`, `bcryptjs`, `nodemon` (dev). No frameworks (Express, React, Vue, Angular, Next.js, Bootstrap, Tailwind) and no ORMs. Ask the team before adding any dependency.

**Code:** CommonJS and async/await in the backend; plain scripts in the frontend. 2-space indent, single quotes, semicolons, camelCase. Style through CSS variables in `frontend/css/style.css`. Don't build UI that looks working but isn't.

**Layers:** routes (`backend/routes/index.js`) -> controllers (HTTP only) -> services (business logic + SQL). Auth and role checks go in `backend/middleware/`.

**Database:** plural snake_case tables, snake_case columns, PK `id`, FKs named `<entity>_id` with constraints. Parameterized queries only (`pool.execute(sql, [params])`).

**API:** use `ok()` / `fail()` from `backend/utils/response.js`. Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error. Routes under `/api`, plural nouns.

**Security:** no credentials in code, `.env` stays untracked, hash passwords with bcryptjs and never return hashes, validate input server-side, enforce roles in the backend, use `textContent` (not `innerHTML`) for user content, app connects with the limited DB user (never root).

**Git:** feature branches, small commits, pull requests reviewed by a teammate, never commit `.env`.

## Changelog
- 2026-10-17: Initial foundation (server, static serving, health endpoint, DB pool, roles/users schema).
