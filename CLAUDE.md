# CLAUDE.md — Local Tourism Package Booking System

College Web Technology assignment, team of three. Keep everything simple and understandable.

## Technology restrictions (STRICT)
- Allowed: HTML5, CSS3, vanilla JS, DOM, Fetch API, Node.js built-ins (esp. `http`), MySQL, `mysql2`.
- Allowed libs: `dotenv`, `bcryptjs`, `nodemon` (dev only). Nothing else without team approval.
- Forbidden: Express, React, Angular, Vue, Next.js, Bootstrap, Tailwind, any framework.

## Architecture
Modular monolith. Node `http` server serves `/frontend` statically and REST under `/api`.
- `backend/server.js` – entry, dispatch, centralized error handling
- `backend/routes/index.js` – route table `'METHOD /api/path' -> handler`
- `backend/controllers/` – HTTP layer (parse input, call service, respond)
- `backend/services/` – business logic and SQL
- `backend/middleware/` – static serving, auth, role checks
- `backend/config/db.js` – mysql2/promise pool
- `backend/utils/` – response and body helpers
- `database/` – `schema.sql`, `seed.sql` (kept separate), `migrations/`

## Folder conventions
- Frontend pages per role: `frontend/{customer,provider,admin,superadmin}/`; public pages at `frontend/` root.
- Shared CSS in `frontend/css/`, shared JS in `frontend/js/` (`api.js` is the fetch helper).
- Only create files that are needed now.

## Coding conventions
- Backend: CommonJS, async/await, no callbacks. Frontend: plain scripts, no modules bundler.
- Style: 2-space indent, single quotes, semicolons, camelCase vars, PascalCase never needed.
- Style via CSS variables in `:root` (`style.css`); no inline styling except trivial cases.
- No fake functionality: do not build UI that looks working but is not.

## Database conventions
- Tables: plural snake_case; columns snake_case; PK `id`; FKs `<entity>_id` with constraints.
- Always parameterized queries (`pool.execute(sql, [params])`). Never string-concatenate input.
- Schema changes go in `database/migrations/NNN_description.sql`; keep `schema.sql` current.

## API response conventions
- Success: `{ "success": true, "data": ... }`; failure: `{ "success": false, "error": { "message": "..." } }`.
- Use helpers `ok()` / `fail()` from `backend/utils/response.js`.
- Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 500 server.
- Routes live under `/api`, plural nouns (e.g. `/api/packages`).

## Security requirements
- No credentials in code; use `.env` (git-ignored); keep `.env.example` updated.
- Hash passwords with `bcryptjs`; never return hashes.
- Validate all input server-side; enforce role checks in backend middleware, not only the UI.
- Block path traversal in static serving; do not leak stack traces to clients.
- Escape user content when inserting into the DOM (`textContent`, not `innerHTML`).

## Git workflow
- Do NOT run git init/commit/push unless asked; the team manages Git.
- Expected: feature branches, small commits, pull requests reviewed by a teammate, never commit `.env`.
