# Local Tourism Package Booking System

A framework-free web application for browsing and booking local tourism packages. Built for a Web Technology course.

## Roles
Customer · Provider (local guide) · Admin · Super Admin

## Tech stack
HTML5, CSS3, vanilla JavaScript (DOM + Fetch API) · Node.js built-in `http` module · MySQL/MariaDB via `mysql2`.
No frontend or backend frameworks.

## Prerequisites
Node.js 18+ and MySQL 8 or MariaDB (running locally).

## Quick start
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your database credentials.
3. Create the database, tables and app user (see [DEVELOPER.md](DEVELOPER.md#database-setup)).
4. `npm start` (or `npm run dev` for auto-reload)
5. Open http://localhost:3000

## Project structure
```
frontend/   pages (prefixed by role: admin-, provider-, superadmin-), css/, js/, assets/
backend/    server.js, config/, routes/, controllers/, middleware/, services/, utils/
database/   schema.sql, seed.sql, migrations/
```

## For contributors
Setup details, API endpoints, database notes and the changelog live in [DEVELOPER.md](DEVELOPER.md).  It also contains the project conventions.
