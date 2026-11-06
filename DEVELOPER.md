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
4. Load the seed data: run `database/seed.sql` (safe to re-run; it won't duplicate rows). Besides the catalogue and demo accounts it grants the demo admin every permission and adds three sample bookings (one completed and reviewed, one confirmed, one unpaid) so the admin, provider and report screens have data.
5. `npm start` should print "Database connected"; `/api/health` should report `"database":"connected"`.

**Already set up and pulled new changes?** Run the new file(s) in `database/migrations/` (as `tourism_user`, no admin needed), then `database/seed.sql` again. Run each migration once, in order (e.g. `mysql -u tourism_user -p local_tourism < database/migrations/010_address_user_unique.sql`). 001, 005, 006, 007, 008, 009 and 010-014 are safe to re-run; 002, 003 and 004 are not (they use `ALTER TABLE`).

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
| `npm run test:api` | End-to-end API checks in `tests/api.test.js` (plain Node). Start the server first; set `TEST_BASE_URL` if it is not on port 3000. Optional argument filters sections, e.g. `node tests/api.test.js moderation`. Cleans up the data it creates |

## API endpoints
Responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/health | Public | Server and database status |
| POST | /api/auth/register | Public | Create an account. Body: `full_name`, `email`, `password` (8-72 chars), optional `phone`, optional `role` (`CUSTOMER` default, or `PROVIDER`; providers start with `provider_status` PENDING). Returns the user (201). 400 invalid input, 409 email already registered. Admin accounts cannot be self-registered |
| POST | /api/auth/login | Public | Body: `email`, `password`. Returns `{ token, user }`. 400 missing fields, 401 wrong email or password (same message for both), 403 account disabled, 429 after 5 failed attempts for the same email and client within 10 minutes |
| GET | /api/auth/me | Bearer token | Return currently authenticated user (`id, full_name, email, phone, role, provider_status`; ADMIN and SUPER_ADMIN also get `permissions`, an array of their effective permission names). 401 unauthenticated, 403 account disabled |
| GET | /api/users/profile | Bearer token | Return user profile with attached address (`id, full_name, email, phone, role, provider_status, address`). 401 unauthenticated |
| PUT | /api/users/profile | Bearer token | Update user profile name, phone, and upsert primary address. Body: `full_name`, optional `phone`, optional `address` (`street, city, state, postal_code, country`). 400 invalid input |
| GET | /api/destinations | Public | All destinations (`id, name, description, image_url`) |
| GET | /api/packages | Public | All APPROVED packages with `destination_name`; optional `?destination_id=<int>` (400 if not an integer) |
| GET | /api/packages/:id | Public | One package with detail fields (`itinerary` and `inclusions` as arrays, `max_group_size`); 400 if id is not an integer, 404 if missing |
| GET | /api/packages/:id/departures | Public | Available departures for an approved package starting from today with live calculated remaining seats (`seats_available`) |
| GET | /api/packages/:id/calendar?month=YYYY-MM | Public | Booking calendar for an approved package: the departures starting in that month (default: current month) as `days: [{ date, end_date, departure_id, seats_total, seats_available, status }]`. `end_date` is the last day of the trip. `status` is `AVAILABLE`, `LIMITED` (25% or fewer seats left), `SOLD_OUT` or `PAST`. 400 bad month or id, 404 unknown or unapproved package |
| GET | /api/wishlist | CUSTOMER | Saved packages, newest first (`package_id, title, price, duration_days, image_url, destination_name, category_name, added_at`). Only APPROVED packages are shown; a package that is later rejected or archived stays saved but hidden |
| POST | /api/wishlist | CUSTOMER | Body: `package_id`. Only APPROVED packages (404 otherwise, 400 for a bad id). Idempotent: 201 when added, 200 if already saved. Returns `{ package_id, wishlisted: true }` |
| DELETE | /api/wishlist/:packageId | CUSTOMER | Idempotent: always 200 with `{ package_id, wishlisted: false, removed }` (`removed` is false if it was not saved); 400 for a bad id |
| GET | /api/bookings/calendar?month=YYYY-MM | CUSTOMER | The customer's own bookings whose trip starts in that month (default: current month), all statuses: `bookings: [{ booking_id, status, num_guests, date, end_date, package_id, package_title, destination_name }]` |
| POST | /api/bookings | CUSTOMER | Create booking reserving seats. Body: `departure_id`, `num_guests`. Locks departure row, verifies seat availability against PENDING/CONFIRMED reservations, computes total_price snapshot, returns booking in PENDING status (201) |
| GET | /api/bookings/my | CUSTOMER | Return all bookings for the logged-in customer with departure date, destination, payment status, and review status |
| POST | /api/bookings/:id/pay | CUSTOMER | Simulate payment for a PENDING booking. Body: `method` (`CARD`, `UPI`, `NET_BANKING`). Locks booking, records payment (PAID), transitions booking to CONFIRMED atomically |
| POST | /api/bookings/:id/cancel | CUSTOMER | Cancel customer booking. Checks cancellation cutoff against `booking_cancellation_hours_limit` setting. If CONFIRMED, marks payment as REFUNDED atomically |
| POST | /api/bookings/:id/review | CUSTOMER | Submit review for customer's own COMPLETED booking. Body: `rating` (1-5), optional `comment`. 400 if trip not completed, 409 if already reviewed |
| * | /api/provider/* | PROVIDER | Provider portal: dashboard, packages, departures, bookings, finance, reviews, reports (see "Provider portal endpoints", "Provider departure management" and "Provider booking management") |
| GET | /api/admin/customers, /api/admin/customers/:id; PATCH /api/admin/customers/:id/status | ADMIN (MANAGE_CUSTOMERS), SUPER_ADMIN | Customer management (see "Admin customer management") |
| GET | /api/admin/providers, /api/admin/providers/:id; PATCH /api/admin/providers/:id/status | ADMIN (MANAGE_PROVIDERS), SUPER_ADMIN | Provider management (see "Admin provider management") |
| GET/POST/PUT/DELETE | /api/admin/destinations[/:id] | ADMIN (MANAGE_CATALOGUE), SUPER_ADMIN | Destination management (see section below) |
| GET/POST/PUT/DELETE | /api/admin/categories[/:id] | ADMIN (MANAGE_CATALOGUE), SUPER_ADMIN | Category management (see section below) |
| GET | /api/admin/packages?status=&search= | ADMIN (MODERATE_PACKAGES), SUPER_ADMIN | Packages of all providers with provider, destination and category (PENDING first). `status` is `PENDING`, `APPROVED`, `REJECTED` or `ARCHIVED` (400 otherwise). Supports pagination |
| GET | /api/admin/packages/:id | ADMIN (MODERATE_PACKAGES), SUPER_ADMIN | One package with itinerary, inclusions and `rejection_reason`; 400 bad id, 404 missing |
| PATCH | /api/admin/packages/:id/status | ADMIN (MODERATE_PACKAGES), SUPER_ADMIN | Body: `status` (`APPROVED` or `REJECTED`), optional `rejection_reason` (max 255, only stored when rejecting). Approving clears the reason. 409 for ARCHIVED packages. Logged as `PACKAGE_APPROVED/REJECTED` |
| GET | /api/admin/bookings | ADMIN (VIEW_BOOKINGS), SUPER_ADMIN | Read-only list of all bookings with customer, package, destination, provider, payment (`payment_status` is `PAID`, `REFUNDED` or `UNPAID`) and review rating. Filters: `status` (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`), `payment_status`, `search` (customer name/email, package, provider), `from` and `to` (`YYYY-MM-DD`, booking date). 400 for invalid filters. Supports pagination |
| GET | /api/admin/bookings/:id | ADMIN (VIEW_BOOKINGS), SUPER_ADMIN | One booking in the same shape; 400 bad id, 404 missing. Admins can monitor bookings but not change them |
| GET | /api/admin/reports?from=&to= | ADMIN (VIEW_REPORTS), SUPER_ADMIN | Platform report for an optional `YYYY-MM-DD` range (400 if invalid). Figures use the booking date. Returns `summary` (booking counts by status, guests, `paid_total`, `refunded_total`, `net_total`, `gross_total`, `new_customers`, `new_providers`), `catalogue` (package counts by status, not date filtered), `monthly`, `top_packages` and `top_providers` (top 5 by revenue), `destinations` and `categories` (bookings and revenue) |
| GET | /api/admin/dashboard | ADMIN, SUPER_ADMIN | Platform-wide customer, provider, package, destination, category, booking and payment summary; includes today's registrations and bookings |
| GET | /api/superadmin/admins?search=&status= | SUPER_ADMIN | List ADMIN accounts (`status` = `ACTIVE` or `DISABLED`) with `permission_count`. Supports pagination |
| POST | /api/superadmin/admins | SUPER_ADMIN | Create an admin. Body: `full_name`, `email`, optional `phone`, `password` (8-72 chars). 409 duplicate email. Never returns the hash |
| GET | /api/superadmin/admins/:id | SUPER_ADMIN | One admin; 404 for any id that is not an ADMIN account (customers, providers and super admins are not reachable here) |
| PUT | /api/superadmin/admins/:id | SUPER_ADMIN | Update `full_name`, `email`, `phone`; a `password` in the body resets it, omit it to keep the current one |
| PATCH | /api/superadmin/admins/:id/status | SUPER_ADMIN | Body: `is_active` (boolean). A disabled admin can no longer log in and existing tokens stop working |
| DELETE | /api/superadmin/admins/:id | SUPER_ADMIN | Delete an admin. 409 if the admin already has audit-log history (disable instead) |
| GET | /api/superadmin/permissions | SUPER_ADMIN | All grantable permissions: `[{ name, description }]` |
| GET | /api/superadmin/admins/:id/permissions | SUPER_ADMIN | `{ admin_id, permissions: [...] }`; 404 if the id is not an ADMIN |
| PUT | /api/superadmin/admins/:id/permissions | SUPER_ADMIN | Replace the admin's full permission set. Body: `permissions` (array of names, 400 for unknown names or a non-array). Effective immediately. Logged as `ADMIN_PERMISSIONS_UPDATED` |
| GET | /api/superadmin/logs | SUPER_ADMIN | Audit log viewer, newest first, with actor name/email/role. Filters: `user_id`, `action` (exact, e.g. `CATEGORY_CREATED`), `entity` (e.g. `categories`), `search` (details, actor name or email), `from` / `to` (`YYYY-MM-DD`). **Always paginated** (default `limit` 20, max 100): `{ items, page, limit, total, total_pages }` |
| GET | /api/superadmin/settings | SUPER_ADMIN | All settings: `setting_key`, `setting_value`, `description`, `updated_at` |
| PUT | /api/superadmin/settings/:key | SUPER_ADMIN | Body: `value`. Only existing settings with a validation rule can be changed (404 otherwise, 400 for invalid values). Logged as `SETTING_UPDATED` with the old and new value |

## Database tables
Migration 014 adds indexes on `bookings.status`, `bookings.created_at`, `packages.status`, `payments.status`, `audit_logs.created_at` and `audit_logs.action` (used by the admin lists, reports and log viewer).

| Table | Notes |
|---|---|
| roles | CUSTOMER, PROVIDER, ADMIN, SUPER_ADMIN (seeded) |
| users | `role_id` FK to roles; `password_hash` (bcryptjs); `phone` (optional); `is_active` (0 = account disabled); `provider_status` NOT_APPLICABLE / PENDING / APPROVED / REJECTED (only used for PROVIDER accounts; a provider must be APPROVED before publishing packages) |
| categories | `name` unique, `description` (seeded: Adventure, Cultural, Beach & Island, Food & Culinary, Nature & Wildlife) |
| destinations | `name` unique, `description`, `image_url` (seeded: Mountains, Beaches, Cities) |
| packages | `destination_id` FK, `category_id` FK to categories (optional), `title` unique, `price`, `duration_days`, `image_url`, `itinerary` and `inclusions` (text, one item per line), `max_group_size` (6 seeded), `rejection_reason` (optional, set by an admin when rejecting; cleared on approval or when the provider edits and resubmits), `provider_id` FK to users (owner), `status` PENDING / APPROVED / REJECTED / ARCHIVED (only APPROVED packages are public) |
| package_departures | Bookable dates: `package_id` FK, `start_date`, `seats_total`; unique per (package, date). Seeded: two per package (30 and 60 days after seeding) |
| bookings | `customer_id` FK to users, `departure_id` FK, `num_guests`, `total_price` (snapshot of price x guests), `status` PENDING / CONFIRMED / CANCELLED / COMPLETED |
| payments | **Simulated** (no real gateway): `booking_id` FK (unique, one per booking), `amount`, `method` CARD / UPI / NET_BANKING, `status` PAID / REFUNDED, `paid_at` |
| reviews | `booking_id` FK (unique, one review per booking), `rating` 1-5 (CHECK), `comment` |
| audit_logs | Admin / super admin action trail: `user_id` FK (actor), `action`, `entity`, `entity_id`, `details`, `created_at`. *Note on specification alignment:* corresponds to `system_logs` in the project spec; standardizes column names with our entity foreign key pattern. |
| admin_permissions | Permissions granted to ADMIN accounts by a super admin: `admin_id` FK to users, `permission` (one of the names in the Admin permissions section), `created_at`; unique per (admin, permission) |
| settings | Key-value store for system settings: `setting_key` PK, `setting_value`, `description`, `updated_at`. Editable keys and their rules are in `backend/utils/settings.js`: `maintenance_mode` (`true`/`false`) and `booking_cancellation_hours_limit` (whole hours, 0-720) |
| wishlists | Customer saved packages: `customer_id` FK to users, `package_id` FK to packages (both `ON DELETE CASCADE`), `created_at`; unique per (customer, package) |
| addresses | User address records: `user_id` FK to users (unique, enforced by migration 010), `street`, `city`, `state`, `postal_code`, `country`, `created_at` |

### Authentication
Login returns a signed token (HMAC-SHA256 using `AUTH_SECRET`, built-in `crypto`; payload `sub` = user id, `role`, `exp` = 8 hours). The client sends it as `Authorization: Bearer <token>`. `backend/utils/token.js` has `createToken` and `verifyToken`. `backend/middleware/auth.js` provides `requireAuth(handler)` and `requireRole(allowedRoles, handler)`.

### Business rules (enforced in services, not just the UI)
- **Completed trips:** a CONFIRMED booking counts as finished once the current date is on or after `start_date + duration_days`. The customer view derives this on the fly, and `completePastBookings()` (run at server start and then hourly) stores `COMPLETED` so admin and provider statistics, which read the stored status, are accurate.
- **Maintenance mode:** when the `maintenance_mode` setting is `true`, every `/api` request except `/api/health` and `/api/auth/login` returns 503 unless it carries a valid ADMIN or SUPER_ADMIN token; static pages stay available so the login page loads. The setting is cached for up to 5 seconds (changes through the API apply immediately).
- **Revenue figures:** a payment row is either `PAID` or `REFUNDED` (cancelling a confirmed booking flips it). So `paid_total` is money still held, `refunded_total` is money returned, and `net_total` equals `paid_total`; `gross_total` (admin report) is paid plus refunded.
- **Seats left** for a departure = `seats_total` minus the `num_guests` of its PENDING and CONFIRMED bookings. A booking must not exceed it.
- **Concurrency & Pessimistic Locking:** Booking creation locks the `package_departures` row using `SELECT ... FOR UPDATE` before re-evaluating seat availability and writing the booking row inside the same transaction.
- **Booking lifecycle:** PENDING (created) -> CONFIRMED (payment made) -> COMPLETED (after departure date + duration_days). CANCELLED is allowed from PENDING or CONFIRMED (a CONFIRMED cancel marks the payment REFUNDED in a single transaction).
- **Cancellation cutoff:** Bookings can only be cancelled prior to departure date minus the hours limit configured in `settings` (`booking_cancellation_hours_limit`, default 24h).
- **Payment (simulated):** the customer selects a method and presses Pay; the server locks the booking, inserts a PAID payment, and confirms the booking in one transaction. Duplicate payments for the same booking are rejected. No card details are collected or stored.
- **Reviews:** only for the customer's own COMPLETED booking (or confirmed where trip end date has passed), once per booking. Verified independently inside `createReview()`.
- **Address management:** each user has one address in `addresses` with a UNIQUE constraint on `user_id`, upserted via `INSERT ... ON DUPLICATE KEY UPDATE`.
- **Provider approval:** new providers start PENDING; an admin approves/rejects. New packages start PENDING; an admin approves/rejects them.
- **Audit logging:** admin and super admin actions write a row to `audit_logs` through `logAction(userId, action, entity, entityId, details)` in `backend/services/auditService.js`. Logging is best effort (a failure is printed to the server console and never breaks the action). Actions logged so far: `CUSTOMER_BLOCKED/UNBLOCKED`, `PROVIDER_APPROVED/REJECTED/BLOCKED/UNBLOCKED`, `DESTINATION_CREATED/UPDATED/DELETED`, `CATEGORY_CREATED/UPDATED/DELETED`, `PACKAGE_APPROVED/REJECTED`, `ADMIN_CREATED/UPDATED/ENABLED/DISABLED/DELETED`, `ADMIN_PERMISSIONS_UPDATED`, `SETTING_UPDATED`. New admin features must log their changes the same way.

### Admin permissions
ADMIN accounts only reach the admin endpoints they have been granted; SUPER_ADMIN always passes. Enforced by `requirePermission()` in `backend/middleware/auth.js` (403 `You do not have permission to perform this action`); changes take effect on the next request. The admin dashboard needs no permission. Names live in `backend/utils/permissions.js`:

| Permission | Unlocks |
|---|---|
| MANAGE_CUSTOMERS | `/api/admin/customers*` |
| MANAGE_PROVIDERS | `/api/admin/providers*` |
| MODERATE_PACKAGES | `/api/admin/packages*` |
| MANAGE_CATALOGUE | `/api/admin/destinations*` and `/api/admin/categories*` |
| VIEW_BOOKINGS | `/api/admin/bookings*` |
| VIEW_REPORTS | `/api/admin/reports` |

A new admin created without `permissions` starts with none (least privilege); pass `permissions` when creating or use the permissions endpoint. Migration 012 and `seed.sql` grant every permission to existing/demo admins.

### Roles and permissions (enforced by backend middleware)
| Action | Customer | Provider | Admin | Super Admin |
|---|---|---|---|---|
| Browse approved packages & departures | yes | yes | yes | yes |
| Book, pay, cancel own booking, review | yes | | | |
| Save packages to a wishlist | yes | | | |
| View & update personal profile/address | yes | yes | yes | yes |
| Create/edit own packages and departures | | approved providers | | |
| View bookings of own packages | | yes | | |
| Approve/reject providers and packages | | | yes | yes |
| Enable/disable customer and provider accounts | | | yes | yes |
| Manage admin accounts, permissions, settings and view audit logs | | | | yes |
| Admin endpoints (customers, providers, packages, catalogue, bookings, reports) | | | only with the matching permission | yes |

Schema changes: add `database/migrations/NNN_description.sql` and update `schema.sql`.

## Adding a feature
1. Service in `backend/services/` (SQL, parameterized).
2. Controller in `backend/controllers/`.
3. Register `'METHOD /api/path'` in `backend/routes/index.js`. Use `:name` for path parameters (e.g. `'GET /api/packages/:id'`); the value is available as `req.params.name`.
4. Update this file (endpoints, tables, env vars).

## Frontend pages
| Page | Status |
|---|---|
| admin-dashboard | Working: ADMIN and SUPER_ADMIN platform overview with customer/provider, catalogue, booking, payment and today's activity metrics |
| index | Landing page; logged-in customers also see a personalized dashboard (name and email from `/api/auth/me`, via `js/home.js`) |
| destinations | Working: lists destinations from the API, links to filtered packages |
| packages | Working: lists packages; filter by destination, text search, min/max price, sort (price, duration), clear filters, results count (all client-side in `js/packages.js`); links to the detail page |
| package | Working: detail page for `package.html?id=<id>` (description, itinerary, inclusions, group size, upcoming departures with live seat count, direct Book Date button) |
| booking | Working: `booking.html?package_id=<id>&departure_id=<id>` customer booking form with dynamic departure selection, guest count slider/input, live price breakdown, and seat availability validation |
| my-bookings | Working: customer booking dashboard showing active/past bookings, status badges, simulated payment modal, cancellation with refund modal, and review submission modal |
| wishlist | Working: customer-only saved packages page (remove with the heart). Heart toggles (`js/wishlist.js`) also appear on `packages` cards and the `package` detail page, for logged-in customers only; a Wishlist link is added to the customer navbar |
| profile | Working: view & edit customer contact info, phone, and postal address with upsert functionality |
| login | Working: token authentication, error alerts, redirect by role |
| provider-dashboard | Working: provider approval status and package/booking/performance summary |
| provider-packages | Working: approved providers can list, create, edit and archive their own packages |
| admin-customers / admin-providers / admin-destinations / admin-categories | Working: admin management pages (search, status filters, create/edit/delete where allowed) |
| admin-packages | Working: package moderation (search, status filter, pagination, detail view, approve or reject with a reason); needs `MODERATE_PACKAGES` |
| admin-bookings | Working: read-only booking monitor (status, payment, date and text filters, pagination, detail view); needs `VIEW_BOOKINGS` |
| superadmin-admins | Working: SUPER_ADMIN only. Create, edit, enable/disable and delete admin accounts, and edit each admin's permission checklist; linked from the admin dashboard (shown only to super admins) |
| superadmin-settings | Working: SUPER_ADMIN only. Edit `maintenance_mode` (with a confirmation before turning it on) and `booking_cancellation_hours_limit`; the server's validation errors are shown as returned |
| superadmin-logs | Working: SUPER_ADMIN only. Paginated audit log with search, action, entity and date filters |
| admin-reports | Working: platform report for an optional date range (totals, monthly trend, top packages and providers, destination and category breakdown); needs `VIEW_REPORTS` |
| provider-departures / provider-bookings / provider-performance / provider-reports | Working: provider departure CRUD, owned bookings, earnings and reviews, business reports |
| register | Working: customer/provider sign-up, validation, auto-login & redirect |

Frontend helpers: `js/api.js` (fetch wrapper with Bearer token injection), `js/auth.js` (token & session helpers, role dashboard routing), `js/render.js` (safe DOM builders), `js/main.js` (health check, dark/light mode toggle, dynamic navbar auth state with role badges and Customer navigation links). Images live in `frontend/assets/img/` (served locally; no hotlinking).

## Notes for frontend developers
- **Token:** `POST /api/auth/login` returns `{ token, user }`; send `Authorization: Bearer <token>` on every request (`js/api.js` does this). Tokens last 8 hours.
- **Who am I:** `GET /api/auth/me` returns the user; for ADMIN and SUPER_ADMIN it also returns `permissions` (see "Admin permissions"). Use it to hide admin menu items, but the backend enforces them anyway.
- **Status codes to handle:** 401 (no or expired token: go to login), 403 (not allowed, or the account was disabled or the provider is not approved), 429 (too many failed logins), 503 (maintenance mode: show a notice; admins are not affected).
- **Lists:** admin lists return arrays; add `?page=&limit=` for the pagination envelope. `GET /api/superadmin/logs` is always paginated.
- **Dates:** send and receive `YYYY-MM-DD`; months are `YYYY-MM`. Money values are numbers in rupees.
- **Pages still to build:** a calendar view for customers.

## Running the API tests
`npm run test:api` (server running first). `tests/api.test.js` is a plain Node script that logs in with the demo accounts, exercises every module (roles, permissions, validation, isolation between providers, money figures, wishlist, calendar, settings, hostile input) and prints a pass/fail list. Each section removes the data it creates, so it can be re-run at any time. Add a section there when you add an endpoint.

## Conventions
**Technology (strict):** only HTML5, CSS3, vanilla JS, Node built-ins (`http`), MySQL/MariaDB with `mysql2`, plus `dotenv`, `bcryptjs`, `nodemon` (dev). No frameworks (Express, React, Vue, Angular, Next.js, Bootstrap, Tailwind) and no ORMs. Ask the team before adding any dependency.

**Code:** CommonJS and async/await in the backend; plain scripts in the frontend. 2-space indent, single quotes, semicolons, camelCase. Style through CSS variables in `frontend/css/style.css`. Don't build UI that looks working but isn't.

**Layers:** routes (`backend/routes/index.js`) -> controllers (HTTP only) -> services (business logic + SQL). Auth and role checks go in `backend/middleware/`.

**Database:** plural snake_case tables, snake_case columns, PK `id`, FKs named `<entity>_id` with constraints. Parameterized queries only (`pool.execute(sql, [params])`).

**API:** use `ok()` / `fail()` from `backend/utils/response.js`. Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 too many failed logins, 500 server error, 503 maintenance mode. A request body must be a JSON object (otherwise 400). Server errors return a generic message, never database details or stack traces. Routes under `/api`, plural nouns.

**Pagination:** list endpoints that support it return a plain array by default. Supported by all admin list endpoints (customers, providers, destinations, categories, packages, bookings). Add `?page=<n>&limit=<n>` (limit max 100, default 10) to get `{ "items": [...], "page", "limit", "total", "total_pages" }` instead; invalid values return 400. Helper: `backend/utils/pagination.js`.

**Security:** no credentials in code, `.env` stays untracked, hash passwords with bcryptjs and never return hashes, validate input server-side, enforce roles in the backend, use `textContent` (not `innerHTML`) for user content, app connects with the limited DB user (never root).

**Git:** feature branches, small commits, pull requests reviewed by a teammate, never commit `.env`.

## Changelog

- 2026-11-06: Customer wishlist frontend: `wishlist` page, heart toggles on package cards and detail page, navbar link (`js/wishlist.js`, `js/wishlist-page.js`).
- 2026-11-06: Super admin frontend: `superadmin-settings` and `superadmin-logs` pages plus dashboard shortcuts.
- 2026-11-06: Super admin frontend: `superadmin-admins` page (admin accounts and permissions) and a super-admin-only shortcut on the admin dashboard.
- 2026-11-06: Security and style cleanup: admin customer, provider and destination tables and details, and the customer review/payment snippets, are built with DOM nodes and `textContent` instead of `innerHTML` (the review comment was not escaped); static inline styles moved into CSS classes. Admin helpers `dataButton` and `fillDetailPanel` added.
- 2026-11-06: Admin frontend: package moderation, booking monitoring and reports pages; shared `admin-common.js`; dashboard and category page updates.
- 2026-11-06: Final backend hardening: migration 014 (reporting indexes); richer `seed.sql` (sample bookings, payment and review, demo admin permissions); login lockout after 5 failed attempts (429); request bodies must be JSON objects; malformed URLs return 400; 5xx responses no longer expose internal error messages; provider bookings `?status=` filter now works; duplicate departure date on create returns 409 instead of 500; API test suite expanded to cover isolation, reviews, edge cases and hostile input.
- 2026-11-06: Booking calendar: `GET /api/packages/:id/calendar` and `GET /api/bookings/calendar` (month view with live seat status). Finished CONFIRMED trips are now stored as COMPLETED by an hourly sweep (`completePastBookings`).
- 2026-11-06: Wishlist: migration 013 (`wishlists` table), `GET/POST /api/wishlist`, `DELETE /api/wishlist/:packageId`.
- 2026-11-06: Step 5.3/5.4 Super admin system tools: `GET /api/superadmin/logs` (filters, SQL pagination), `GET /api/superadmin/settings`, `PUT /api/superadmin/settings/:key` with per-key validation. `maintenance_mode` is now enforced for non-admin API requests (503).
- 2026-11-06: Step 5.2 Admin permissions: `requirePermission()` middleware now guards every admin endpoint (except the dashboard); `GET /api/superadmin/permissions`, `GET/PUT /api/superadmin/admins/:id/permissions`; optional `permissions` when creating an admin; `/api/auth/me` returns `permissions` for admins; migration 012 grants existing admins everything; `seed.sql` grants the demo admin everything.
- 2026-11-06: Step 5.1 Super admin admin-account management: `/api/superadmin/admins` (list, create, get, update, enable/disable, delete), all logged. `tests/api.test.js` now removes the audit entries it creates.
- 2026-11-06: Admin reports: `GET /api/admin/reports`. Pagination now works on the customers, providers, destinations and categories admin lists. Fixes: net revenue no longer subtracts refunds twice (provider finance, provider reports, admin dashboard `net_collected`); admin category search now works.
- 2026-11-06: Admin booking monitoring: `GET /api/admin/bookings` (filters, pagination) and `GET /api/admin/bookings/:id`; `backend/utils/dates.js` date parameter validation; booking tests added to `tests/api.test.js`.
- 2026-11-06: Admin package moderation: `GET /api/admin/packages`, `GET /api/admin/packages/:id`, `PATCH /api/admin/packages/:id/status`; migration 011 adds `packages.rejection_reason` (shown to the provider); optional pagination helper; `tests/api.test.js` and `npm run test:api`.
- 2026-11-06: Step 6 audit logging: new `auditService.logAction()`; customer, provider, destination and category admin actions now write to `audit_logs`.
- 2026-11-06: Documentation sync: documented provider portal endpoints, admin management endpoints and pages, rewrote the Step 4.5 category section, and recorded migration 010 (unique `addresses.user_id`).

- 2026-11-05: Step 4.1 Admin Dashboard: added an admin-only platform summary API and dashboard page for account, catalogue, booking and payment metrics; ADMIN and SUPER_ADMIN login redirects now lead to the admin dashboard.

- 2026-11-04: Step 2 Customer Booking Flow: implemented departure availability API, concurrent booking creation with pessimistic row locking (`FOR UPDATE`), duplicate payment prevention with single-transaction confirmation, cancellation with eligibility rules and automated refunds, review submission for completed bookings, and user profile with address upsert. Added frontend pages: `booking.html`, `my-bookings.html`, `profile.html`, updated `package.html` and navbar auth routing. Added migration `010_address_user_unique.sql`.

- 2026-11-04: Schema migration 009 added: categories, admin_permissions, settings, and addresses tables, plus category_id FK on packages. Seed data expanded with default categories and system settings. DEVELOPER.md updated.

- 2026-11-01: Packages page search, sorting and price/destination filtering (client-side); personalized customer dashboard on the home page (`home.js`); customers now redirect to `/` after login.

- 2026-10-28: Auth UX refinements: added logout confirmation modal, fixed bfcache back-navigation redirection on login and register pages (pageshow and window.location.replace), and updated registration progress status indicators.
- 2026-10-28: Auth middleware (`requireAuth`, `requireRole`) in `backend/middleware/auth.js`, `GET /api/auth/me` endpoint, wired `login.html` and `register.html` with client validation, token storage, and dynamic navbar state with role-based redirection.
- 2026-10-28: Auth endpoints `POST /api/auth/register` and `POST /api/auth/login` (signed tokens, new `AUTH_SECRET` env variable).
- 2026-10-27: Full database schema: migrations 003-008 (user status and provider approval, package ownership and moderation, departures, bookings, simulated payments, reviews, audit logs); demo accounts and departures in the seed; public package endpoints now return APPROVED packages only.
- 2026-10-21: Dark mode support (CSS variables in `style.css`, animated toggle in `main.js`, `localStorage` & `prefers-color-scheme` persistence across all pages).
- 2026-10-18: Package detail page (migration 002, `GET /api/packages/:id`, path-parameter routing, `package.html`).
- 2026-10-17: Destinations and packages (tables, migration 001, seed, list endpoints, pages, local images).
- 2026-10-17: Initial foundation (server, static serving, health endpoint, DB pool, roles/users schema).


## Provider portal endpoints (Step 3)

All require an APPROVED provider (`requireApprovedProvider`) except the dashboard, which requires the PROVIDER role. Records are always scoped by `packages.provider_id = authenticated user id`.

| Method | Path | Description |
|---|---|---|
| GET | /api/provider/dashboard | Approval status plus package, booking, revenue, review and departure counts |
| GET | /api/provider/package-options | Destinations and categories for the package form |
| GET | /api/provider/packages | List own packages |
| POST | /api/provider/packages | Create a package (starts PENDING for admin moderation) |
| PUT | /api/provider/packages/:id | Edit an own package |
| DELETE | /api/provider/packages/:id | Archive an own package (sets status `ARCHIVED`) |
| GET | /api/provider/finance | Earnings: paid and refunded payment totals for own packages |
| GET | /api/provider/reviews | Reviews of own packages |
| GET | /api/provider/reports?from=&to= | Business report: booking counts by status, payment totals, per-package breakdown for an optional date range |

Departure and booking endpoints are described in their own sections below.

Provider frontend pages: `provider-dashboard`, `provider-packages`, `provider-departures`, `provider-bookings`, `provider-performance` (earnings/reviews), `provider-reports`.
Admin frontend pages: `admin-dashboard`, `admin-customers`, `admin-providers`, `admin-destinations`, `admin-categories`, `admin-packages`, `admin-bookings`, `admin-reports`. They share `js/admin-common.js` (table, pager, status pill and form helpers).

## Provider departure management

Approved providers can manage departures only for their own approved packages.
- `GET /api/provider/departure-packages`
- `GET /api/provider/departures`
- `POST /api/provider/departures`
- `PUT /api/provider/departures/:id`
- `DELETE /api/provider/departures/:id`

Departure capacity is validated against non-cancelled booked seats. A second departure on the same date for one package returns 409 (on create and on update). A departure with booking history cannot be deleted. The existing `package_departures` table from migration `005_departures_bookings.sql` is reused; no database migration is required.

### Provider booking management (Step 3.4)
Approved providers can view booking records associated with packages they own:
- `GET /api/provider/bookings?status=` — list bookings with customer, package, departure and payment details; optional `status` filter (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, 400 otherwise).
- `GET /api/provider/bookings/:id` — retrieve one owned booking.
- `POST /api/provider/bookings/:id/confirm` — confirm an owned pending booking only when its payment is marked `PAID`.

All provider booking queries scope records through `packages.provider_id = authenticated user id`. Payment processing currently confirms paid bookings automatically; the provider confirmation action is a guarded fallback.
Frontend: `/provider-bookings.html`.


## Admin customer management (Step 4.2)

Admin and Super Admin customer-management endpoints:

- `GET /api/admin/customers?search=&status=` lists customer accounts. `status` may be `ACTIVE` or `BLOCKED`; search matches name, email, or phone.
- `GET /api/admin/customers/:id` returns one customer's details and booking count.
- `PATCH /api/admin/customers/:id/status` accepts `{ "is_active": true|false }` to unblock or block a customer.

These endpoints are restricted to `ADMIN` and `SUPER_ADMIN`. The service filters by the `CUSTOMER` role, so provider and administrator accounts cannot be changed through customer-management routes. No schema migration is required.


## Admin provider management (Step 4.3)

Admin and Super Admin provider-management endpoints:
- `GET /api/admin/providers?search=&status=` lists provider accounts. Status filters: `PENDING`, `APPROVED`, `REJECTED`, `BLOCKED`.
- `GET /api/admin/providers/:id` returns provider details with package and booking counts.
- `PATCH /api/admin/providers/:id/status` accepts either `{ "provider_status": "APPROVED" }`, `{ "provider_status": "REJECTED" }`, or `{ "is_active": false|true }` to block/unblock account access.

Approval state (`provider_status`) is kept separate from account access (`is_active`). Only users with the `PROVIDER` role can be changed through these endpoints. Both endpoints and the management page are restricted to `ADMIN` and `SUPER_ADMIN`. No schema migration is required because the existing users table already stores provider approval and active-account state.

## Admin destination management (Step 4.4)

Admin and Super Admin endpoints:
- `GET /api/admin/destinations?search=` lists destinations and package counts.
- `GET /api/admin/destinations/:id` returns destination details.
- `POST /api/admin/destinations` creates a destination with `name`, `description`, and `image_url`.
- `PUT /api/admin/destinations/:id` updates those fields.
- `DELETE /api/admin/destinations/:id` deletes a destination only when no packages reference it.

Destination names are unique. Duplicate names return HTTP 409. A destination linked to packages cannot be deleted and returns HTTP 409. All SQL uses parameterized values. No schema migration is required.

## Admin category management (Step 4.5)

Admin and Super Admin endpoints (frontend: `/admin-categories.html`):
- `GET /api/admin/categories?search=` lists categories with package counts.
- `GET /api/admin/categories/:id` returns one category.
- `POST /api/admin/categories` creates a category (`name`, `description`).
- `PUT /api/admin/categories/:id` updates it.
- `DELETE /api/admin/categories/:id` deletes it only when no packages reference it.

Duplicate category names return 409; deleting a category linked to packages returns 409. No schema migration required.

