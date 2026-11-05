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

**Already set up and pulled new changes?** Run the new file(s) in `database/migrations/` (as `tourism_user`, no admin needed), then `database/seed.sql` again. Run each migration once, in order (e.g. `mysql -u tourism_user -p local_tourism < database/migrations/010_address_user_unique.sql`). 001, 005, 006, 007, 008, 009 and 010 are safe to re-run; 002, 003 and 004 are not (they use `ALTER TABLE`).

**Demo accounts (development only, created by `seed.sql`):** `customer@`, `provider@`, `admin@`, `superadmin@example.com`, all with password `Demo@1234`. Never use these outside local development.

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
| AUTH_SECRET | Secret used to sign login tokens; use a long random string, never share or commit it. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | change_me_to_a_long_random_string |

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
| GET | /api/packages | Public | All APPROVED packages with `destination_name`; optional `?destination_id=<int>` (400 if not an integer) |
| GET | /api/packages/:id | Public | One package with detail fields (`itinerary` and `inclusions` as arrays, `max_group_size`); 400 if id is not an integer, 404 if missing |
| GET | /api/packages/:id/departures | Public | Available departures for an approved package starting from today with live calculated remaining seats (`seats_available`) |
| POST | /api/auth/register | Public | Create an account. Body: `full_name`, `email`, `password` (8-72 chars), optional `phone`, optional `role` (`CUSTOMER` default, or `PROVIDER`; providers start with `provider_status` PENDING). Returns the user (201). 400 invalid input, 409 email already registered. Admin accounts cannot be self-registered |
| POST | /api/auth/login | Public | Body: `email`, `password`. Returns `{ token, user }`. 400 missing fields, 401 wrong email or password (same message for both), 403 account disabled |
| GET | /api/auth/me | Bearer token | Return currently authenticated user (`id, full_name, email, phone, role, provider_status`). 401 unauthenticated, 403 account disabled |
| GET | /api/users/profile | Bearer token | Return user profile with attached address (`id, full_name, email, phone, role, provider_status, address`). 401 unauthenticated |
| PUT | /api/users/profile | Bearer token | Update user profile name, phone, and upsert primary address. Body: `full_name`, optional `phone`, optional `address` (`street, city, state, postal_code, country`). 400 invalid input |
| POST | /api/bookings | CUSTOMER | Create booking reserving seats. Body: `departure_id`, `num_guests`. Locks departure row, verifies seat availability against PENDING/CONFIRMED reservations, computes total_price snapshot, returns booking in PENDING status (201) |
| GET | /api/bookings/my | CUSTOMER | Return all bookings for the logged-in customer with departure date, destination, payment status, and review status |
| POST | /api/bookings/:id/pay | CUSTOMER | Simulate payment for a PENDING booking. Body: `method` (`CARD`, `UPI`, `NET_BANKING`). Locks booking, records payment (PAID), transitions booking to CONFIRMED atomically |
| POST | /api/bookings/:id/cancel | CUSTOMER | Cancel customer booking. Checks cancellation cutoff against `booking_cancellation_hours_limit` setting. If CONFIRMED, marks payment as REFUNDED atomically |
| POST | /api/bookings/:id/review | CUSTOMER | Submit review for customer's own COMPLETED booking. Body: `rating` (1-5), optional `comment`. 400 if trip not completed, 409 if already reviewed |

## Database tables
| Table | Notes |
|---|---|
| roles | CUSTOMER, PROVIDER, ADMIN, SUPER_ADMIN (seeded) |
| users | `role_id` FK to roles; `password_hash` (bcryptjs); `phone` (optional); `is_active` (0 = account disabled); `provider_status` NOT_APPLICABLE / PENDING / APPROVED / REJECTED (only used for PROVIDER accounts; a provider must be APPROVED before publishing packages) |
| categories | `name` unique, `description` (seeded: Adventure, Cultural, Beach & Island, Food & Culinary, Nature & Wildlife) |
| destinations | `name` unique, `description`, `image_url` (seeded: Mountains, Beaches, Cities) |
| packages | `destination_id` FK, `category_id` FK to categories (optional), `title` unique, `price`, `duration_days`, `image_url`, `itinerary` and `inclusions` (text, one item per line), `max_group_size` (6 seeded), `provider_id` FK to users (owner), `status` PENDING / APPROVED / REJECTED / ARCHIVED (only APPROVED packages are public) |
| package_departures | Bookable dates: `package_id` FK, `start_date`, `seats_total`; unique per (package, date). Seeded: two per package (30 and 60 days after seeding) |
| bookings | `customer_id` FK to users, `departure_id` FK, `num_guests`, `total_price` (snapshot of price x guests), `status` PENDING / CONFIRMED / CANCELLED / COMPLETED |
| payments | **Simulated** (no real gateway): `booking_id` FK (unique, one per booking), `amount`, `method` CARD / UPI / NET_BANKING, `status` PAID / REFUNDED, `paid_at` |
| reviews | `booking_id` FK (unique, one review per booking), `rating` 1-5 (CHECK), `comment` |
| audit_logs | Admin / super admin action trail: `user_id` FK (actor), `action`, `entity`, `entity_id`, `details`, `created_at`. *Note on specification alignment:* corresponds to `system_logs` in the project spec; standardizes column names with our entity foreign key pattern. |
| admin_permissions | Super admin granular permission assignments for admins: `admin_id` FK to users, `permission`, `created_at` |
| settings | Extensible key-value store for application/system settings: `setting_key` PK, `setting_value`, `description`, `updated_at` |
| addresses | User address records: `user_id` FK to users (unique), `street`, `city`, `state`, `postal_code`, `country`, `created_at` |

### Authentication
Login returns a signed token (HMAC-SHA256 using `AUTH_SECRET`, built-in `crypto`; payload `sub` = user id, `role`, `exp` = 8 hours). The client sends it as `Authorization: Bearer <token>`. `backend/utils/token.js` has `createToken` and `verifyToken`. `backend/middleware/auth.js` provides `requireAuth(handler)` and `requireRole(allowedRoles, handler)`.

### Business rules (enforced in services, not just the UI)
- **Seats left** for a departure = `seats_total` minus the `num_guests` of its PENDING and CONFIRMED bookings. A booking must not exceed it.
- **Concurrency & Pessimistic Locking:** Booking creation locks the `package_departures` row using `SELECT ... FOR UPDATE` before re-evaluating seat availability and writing the booking row inside the same transaction.
- **Booking lifecycle:** PENDING (created) -> CONFIRMED (payment made) -> COMPLETED (after departure date + duration_days). CANCELLED is allowed from PENDING or CONFIRMED (a CONFIRMED cancel marks the payment REFUNDED in a single transaction).
- **Cancellation cutoff:** Bookings can only be cancelled prior to departure date minus the hours limit configured in `settings` (`booking_cancellation_hours_limit`, default 24h).
- **Payment (simulated):** the customer selects a method and presses Pay; the server locks the booking, inserts a PAID payment, and confirms the booking in one transaction. Duplicate payments for the same booking are rejected. No card details are collected or stored.
- **Reviews:** only for the customer's own COMPLETED booking (or confirmed where trip end date has passed), once per booking. Verified independently inside `createReview()`.
- **Address management:** each user has one address in `addresses` with a UNIQUE constraint on `user_id`, upserted via `INSERT ... ON DUPLICATE KEY UPDATE`.
- **Provider approval:** new providers start PENDING; an admin approves/rejects. New packages start PENDING; an admin approves/rejects them.
- **Audit logging:** admin and super admin actions (approvals, user changes) write a row to `audit_logs`.

### Roles and permissions (enforced by backend middleware)
| Action | Customer | Provider | Admin | Super Admin |
|---|---|---|---|---|
| Browse approved packages & departures | yes | yes | yes | yes |
| Book, pay, cancel own booking, review | yes | | | |
| View & update personal profile/address | yes | yes | yes | yes |
| Create/edit own packages and departures | | approved providers | | |
| View bookings of own packages | | yes | | |
| Approve/reject providers and packages | | | yes | yes |
| Enable/disable customer and provider accounts | | | yes | yes |
| Manage admin accounts and view audit logs | | | | yes |

Schema changes: add `database/migrations/NNN_description.sql` and update `schema.sql`.

## Adding a feature
1. Service in `backend/services/` (SQL, parameterized).
2. Controller in `backend/controllers/`.
3. Register `'METHOD /api/path'` in `backend/routes/index.js`. Use `:name` for path parameters (e.g. `'GET /api/packages/:id'`); the value is available as `req.params.name`.
4. Update this file (endpoints, tables, env vars).

## Frontend pages
| Page | Status |
|---|---|
| index | Landing page; logged-in customers also see a personalized dashboard (name and email from `/api/auth/me`, via `js/home.js`) |
| destinations | Working: lists destinations from the API, links to filtered packages |
| packages | Working: lists packages; filter by destination, text search, min/max price, sort (price, duration), clear filters, results count (all client-side in `js/packages.js`); links to the detail page |
| package | Working: detail page for `package.html?id=<id>` (description, itinerary, inclusions, group size, upcoming departures with live seat count, direct Book Date button) |
| booking | Working: `booking.html?package_id=<id>&departure_id=<id>` customer booking form with dynamic departure selection, guest count slider/input, live price breakdown, and seat availability validation |
| my-bookings | Working: customer booking dashboard showing active/past bookings, status badges, simulated payment modal, cancellation with refund modal, and review submission modal |
| profile | Working: view & edit customer contact info, phone, and postal address with upsert functionality |
| login | Working: token authentication, error alerts, redirect by role |
| provider-dashboard | Working: provider approval status and package/booking/performance summary |
| provider-packages | Working: approved providers can list, create, edit and archive their own packages |
| register | Working: customer/provider sign-up, validation, auto-login & redirect |

Frontend helpers: `js/api.js` (fetch wrapper with Bearer token injection), `js/auth.js` (token & session helpers, role dashboard routing), `js/render.js` (safe DOM builders), `js/main.js` (health check, dark/light mode toggle, dynamic navbar auth state with role badges and Customer navigation links). Images live in `frontend/assets/img/` (served locally; no hotlinking).

## Conventions
**Technology (strict):** only HTML5, CSS3, vanilla JS, Node built-ins (`http`), MySQL/MariaDB with `mysql2`, plus `dotenv`, `bcryptjs`, `nodemon` (dev). No frameworks (Express, React, Vue, Angular, Next.js, Bootstrap, Tailwind) and no ORMs. Ask the team before adding any dependency.

**Code:** CommonJS and async/await in the backend; plain scripts in the frontend. 2-space indent, single quotes, semicolons, camelCase. Style through CSS variables in `frontend/css/style.css`. Don't build UI that looks working but isn't.

**Layers:** routes (`backend/routes/index.js`) -> controllers (HTTP only) -> services (business logic + SQL). Auth and role checks go in `backend/middleware/`.

**Database:** plural snake_case tables, snake_case columns, PK `id`, FKs named `<entity>_id` with constraints. Parameterized queries only (`pool.execute(sql, [params])`).

**API:** use `ok()` / `fail()` from `backend/utils/response.js`. Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 500 server error. Routes under `/api`, plural nouns.

**Security:** no credentials in code, `.env` stays untracked, hash passwords with bcryptjs and never return hashes, validate input server-side, enforce roles in the backend, use `textContent` (not `innerHTML`) for user content, app connects with the limited DB user (never root).

**Git:** feature branches, small commits, pull requests reviewed by a teammate, never commit `.env`.

## Changelog

- 2026-11-04: Step 2 Customer Booking Flow: implemented departure availability API, concurrent booking creation with pessimistic row locking (`FOR UPDATE`), duplicate payment prevention with single-transaction confirmation, cancellation with eligibility rules and automated refunds, review submission for completed bookings, and user profile with address upsert. Added frontend pages: `booking.html`, `my-bookings.html`, `profile.html`, updated `package.html` and navbar auth routing. Added migration `010_address_user_unique.sql`.

- 2026-11-04: Schema migration 009 added: categories, admin_permissions, settings, and addresses tables, plus category_id FK on packages. Seed data expanded with default categories and system settings. DEVELOPER.md updated.

- 2026-11-01: Packages page search, sorting and price/destination filtering (client-side); personalized customer dashboard on the home page (`home.js`); customers now redirect to `/` after login.

- 2026-10-28: Auth UX refinements: added logout confirmation modal, fixed bfcache back-navigation redirection on login and register pages (pageshow and window.location.replace), and updated registration progress status indicators.
- 2026-10-28: Auth UX refinements: added logout confirmation modal, fixed bfcache back-navigation redirection on login and register pages (pageshow and window.location.replace), and updated registration progress status indicators.
- 2026-10-28: Auth middleware (`requireAuth`, `requireRole`) in `backend/middleware/auth.js`, `GET /api/auth/me` endpoint, wired `login.html` and `register.html` with client validation, token storage, and dynamic navbar state with role-based redirection.
- 2026-10-28: Auth endpoints `POST /api/auth/register` and `POST /api/auth/login` (signed tokens, new `AUTH_SECRET` env variable).
- 2026-10-27: Full database schema: migrations 003-008 (user status and provider approval, package ownership and moderation, departures, bookings, simulated payments, reviews, audit logs); demo accounts and departures in the seed; public package endpoints now return APPROVED packages only.
- 2026-10-21: Dark mode support (CSS variables in `style.css`, animated toggle in `main.js`, `localStorage` & `prefers-color-scheme` persistence across all pages).
- 2026-10-18: Package detail page (migration 002, `GET /api/packages/:id`, path-parameter routing, `package.html`).
- 2026-10-17: Destinations and packages (tables, migration 001, seed, list endpoints, pages, local images).
- 2026-10-17: Initial foundation (server, static serving, health endpoint, DB pool, roles/users schema).


## Provider departure management

Approved providers can manage departures only for their own approved packages.
- `GET /api/provider/departure-packages`
- `GET /api/provider/departures`
- `POST /api/provider/departures`
- `PUT /api/provider/departures/:id`
- `DELETE /api/provider/departures/:id`

Departure capacity is validated against non-cancelled booked seats. A departure with booking history cannot be deleted. The existing `package_departures` table from migration `005_departures_bookings.sql` is reused; no database migration is required.
