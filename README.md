# Local Tourism Package Booking System

A web application for browsing and booking local tourism packages, built for a Web Technology course by a team of three. It is deliberately framework-free: plain HTML, CSS and JavaScript in the browser, and Node's built-in `http` module with MySQL on the server.

Four kinds of users share one site:

| Role | What they do |
|---|---|
| **Customer** | Browse destinations and packages, save favourites, book a departure, pay (simulated), cancel, and review finished trips |
| **Provider** (local guide) | Create packages and departures, follow bookings on their own packages, see earnings, reviews and reports |
| **Admin** | Approve providers and packages, manage customers, destinations and categories, monitor bookings and view platform reports. Each admin only gets the features a super admin has granted |
| **Super Admin** | Everything an admin can do, plus managing admin accounts and permissions, system settings (maintenance mode, cancellation window) and the audit log |

## Features

**Public**
- Landing page, destination list and package list with search, destination filter, price range and sorting
- Package detail page with itinerary, inclusions, upcoming departures with live seat counts and a month calendar coloured by availability

**Customer**
- Register and log in; edit profile and address
- Wishlist (heart button on packages, dedicated page)
- Booking form with live price, then simulated payment (card, UPI or net banking; nothing real is collected or stored)
- My Bookings with status badges, cancellation (with automatic refund when allowed), reviews, and a calendar of your own trips

**Provider**
- Dashboard with approval status and summary figures
- Own packages (create, edit, archive; new packages wait for admin approval), departures and bookings
- Earnings, reviews and business reports for a date range

**Admin / Super Admin**
- Dashboard with platform-wide figures
- Customer and provider management (search, filter, block or unblock, approve or reject providers)
- Destination and category management
- Package moderation (approve, or reject with a reason shown to the provider)
- Read-only booking monitor and platform reports
- Super admin only: admin accounts, per-admin permissions, settings and the audit log

## Technology

- **Frontend:** HTML5, CSS3 (variables, light and dark theme), vanilla JavaScript, DOM and the Fetch API. No bundler.
- **Backend:** Node.js 18+ using only the built-in `http` module, with a small router, controllers and services.
- **Database:** MySQL 8 or MariaDB through `mysql2` with parameterised queries only.
- **Libraries:** `dotenv`, `bcryptjs`, and `nodemon` for development. That is all.
- **Not used:** Express, React, Angular, Vue, Bootstrap, Tailwind or any ORM.

## Getting started

### Prerequisites
- Node.js 18 or newer
- MySQL 8 or MariaDB running locally

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file and fill in your own values (never commit `.env`):
   ```bash
   cp .env.example .env
   ```
   Set `DB_PASSWORD`, and set `AUTH_SECRET` to a long random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Create the database, tables and the limited app user, then load the sample data. The exact SQL is in [DEVELOPER.md](DEVELOPER.md#database-setup). In short, as a database admin run `database/schema.sql`, create `tourism_user` with access to `local_tourism` only, then run `database/seed.sql`.
4. Start the server:
   ```bash
   npm start        # or: npm run dev   (auto-reload with nodemon)
   ```
   You should see "Database connected". `http://localhost:3000/api/health` should report the database as connected.
5. Open http://localhost:3000.

### Demo accounts
Created by `database/seed.sql` for local development only. The password for all of them is `Demo@1234`.

| Role | Email |
|---|---|
| Customer | customer@example.com |
| Provider | provider@example.com |
| Admin | admin@example.com |
| Super Admin | superadmin@example.com |

Never use these accounts or this password outside your own machine.

### Running the tests
With the server running in another terminal:
```bash
npm run test:api
```
This runs the end-to-end API checks in `tests/api.test.js` (roles, permissions, validation, bookings and payments, wishlist, calendar, settings, hostile input) against your local database and cleans up the data it creates.

## Project structure
```
frontend/   Pages (admin-*, provider-*, superadmin-* by role; others are public or customer),
            css/style.css, js/ (one script per page plus shared helpers), assets/img/
backend/    server.js (entry), routes/, controllers/, services/, middleware/, config/, utils/
database/   schema.sql, seed.sql, migrations/
tests/      api.test.js
```
The server serves `frontend/` as static files and the REST API under `/api`. Controllers handle HTTP, services hold the business rules and SQL.

## Security notes
- Passwords are hashed with `bcryptjs`; hashes are never returned by the API.
- Login tokens are signed with `AUTH_SECRET`, expire after 8 hours, and repeated failed logins are rate limited.
- Roles and admin permissions are enforced in the backend, not only hidden in the UI.
- All SQL is parameterised; user content is inserted into pages with `textContent`.
- Static file serving blocks path traversal, and server errors never expose stack traces.
- The app connects with a dedicated database user limited to `local_tourism`, never root.
- Payments are simulated. No card or bank details are collected.

## Documentation
Day-to-day details live in [DEVELOPER.md](DEVELOPER.md): database setup, environment variables, every API endpoint, business rules, frontend page status, coding conventions and the changelog. Keep it updated whenever you change an endpoint, table, script or setup step.

## Team workflow
Work on feature branches, make small commits, and open pull requests that a teammate reviews. Do not commit `.env`.
