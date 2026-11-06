# Local Tourism Package Booking System

A comprehensive multi-role web application designed for discovering, booking, and managing local travel experiences. Built collaboratively by a three-member team for an academic Web Technology course, the application demonstrates production-ready web fundamentals without third-party frameworks: the frontend uses standards-compliant HTML5, CSS3, and vanilla JavaScript, while the backend relies directly on Node.js core modules and raw SQL queries via MySQL.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Architecture and Philosophy](#core-architecture-and-philosophy)
3. [User Roles and Workflows](#user-roles-and-workflows)
4. [Key Features](#key-features)
5. [Technology Stack](#technology-stack)
6. [System Design and Business Logic](#system-design-and-business-logic)
7. [Directory Structure](#directory-structure)
8. [Installation and Setup](#installation-and-setup)
9. [Pre-seeded Demo Accounts](#pre-seeded-demo-accounts)
10. [Automated Testing](#automated-testing)
11. [Security Practices](#security-practices)
12. [Contributing and Team Guidelines](#contributing-and-team-guidelines)

---

## Project Overview

The Local Tourism Package Booking System connects local tour operators with travellers seeking authentic regional experiences. Instead of relying on generic travel directories, this platform models the complete end-to-end lifecycle of tourism operations:

- Tour providers can draft packages, schedule departures, monitor seat reservations, and analyze revenue.
- Platform administrators evaluate new providers and package submissions before making them publicly discoverable.
- Customers can search curated offerings, check live seat availability on an interactive calendar, reserve seats safely against concurrent bookings, pay through a simulated gateway, and review past journeys.
- Super administrators retain centralized governance over platform settings, system maintenance, audit logs, and granular staff permissions.

The system is engineered to explain technical concepts simply: clear separation of concerns, defensive validation, and transparent data models allow both technical reviewers and non-technical stakeholders to inspect every part of the booking journey.

---

## Core Architecture and Philosophy

Modern web development often obscures core mechanics behind layers of frameworks, build tooling, and Object-Relational Mappers (ORMs). This project purposefully strips away abstractions to expose foundational web standards:

1. **Zero UI Frameworks**: Built using pure semantic HTML5, accessible form controls, clean CSS custom properties (variables) supporting both light and dark themes, and native Document Object Model (DOM) scripting. Pages require no compilation, bundlers, or asset pipelines.
2. **Lean Server Execution**: The server utilizes Node's built-in `http` module rather than external frameworks such as Express. Routing, parameter extraction, JSON parsing, and CORS headers are implemented transparently from scratch.
3. **Explicit Database Access**: All persistence is managed through direct, parameterized SQL queries using `mysql2`. Relationships, integrity constraints, and transactional consistency are clearly observable in schema scripts rather than hidden behind an ORM.
4. **Pessimistic Concurrency**: Prevents race conditions during simultaneous seat bookings using database row locks (`SELECT ... FOR UPDATE`), ensuring that a departure can never be overbooked regardless of traffic spikes.

---

## User Roles and Workflows

The platform serves four distinct user types from a single unified web application:

| Role | Primary Purpose | Key Capabilities |
|---|---|---|
| **Public Visitor** | Discovery | Explore destinations, filter packages, examine itineraries, and check departure calendar availability without an account. |
| **Customer** | Booking & Travel Management | Register, manage saved packages (wishlist), reserve seats, simulate payments, manage cancellations/refunds, and submit post-trip reviews. |
| **Provider** (Local Guide / Operator) | Package & Departure Operations | Apply as an operator, publish tourism itineraries, configure scheduled dates and seat counts, track incoming bookings, and monitor financial returns. |
| **Admin** | Operational Governance | Verify provider profiles, curate destination categories, moderate new itineraries, review booking records, and inspect platform analytics. Access is governed by granular permissions assigned by a Super Admin. |
| **Super Admin** | Platform Authority | Retains full administrative access, provisions administrator credentials, allocates staff permissions, toggles maintenance mode, adjusts operational thresholds, and inspects the audit log. |

---

## Key Features

### For Travellers and the Public

- **Interactive Search and Filtering**: Instant client-side search across titles and descriptions, destination filtering, price boundary adjustments, and duration-based sorting.
- **Detailed Tour Overviews**: Comprehensive package views presenting day-by-day itineraries, transparent inclusions/exclusions, maximum group capacities, and operator details.
- **Visual Departure Calendar**: An intuitive calendar showing every scheduled departure for a selected month, with visual color indicators designating open seats, limited availability (25% or fewer remaining), sold-out dates, or past departures.
- **Personalized Customer Dashboard**: Dedicated area showing upcoming and past journeys, payment statuses, and downloadable booking summaries.
- **Wishlist Support**: One-click package saving with persistent storage, allowing users to curate potential trips across multiple sessions.
- **Simulated Payment Gateway**: Safe, sandboxed checkout supporting simulated Credit Card, UPI, and Net Banking payments without collecting real financial information.
- **Flexible Cancellations and Automated Refunds**: Automatic refund calculation based on configurable system cancellation windows (e.g., up to 24 hours prior to departure).
- **Verified Reviews**: Authentic feedback submission restricted to travellers who have legitimately completed a given tour departure.

### For Tour Providers

- **Operator Onboarding**: Dedicated registration flow with administrative review gates to guarantee verified tour operators.
- **Package Management**: Multi-step itinerary drafting, inclusion detailing, and media linking with moderation statuses (`PENDING`, `APPROVED`, `REJECTED`, `ARCHIVED`).
- **Departure Scheduling**: Creation and modification of specific departure dates, capacities, and base pricing with automatic duplicate protection.
- **Reservation Oversight**: Real-time visibility into customer reservations, passenger counts, and payment settlements.
- **Financial and Performance Analytics**: Date-range reporting covering gross reservations, refund tallies, net earnings, and customer ratings.

### For Administrative Staff

- **Granular Permission Controls**: Super administrators assign specific functional privileges (`MANAGE_CUSTOMERS`, `MANAGE_PROVIDERS`, `MODERATE_PACKAGES`, `MANAGE_CATALOGUE`, `VIEW_BOOKINGS`, `VIEW_REPORTS`) to individual admin accounts on a principle-of-least-privilege basis.
- **Account Moderation**: Fast filtering, verification, suspension, or reactivation of customer and provider accounts.
- **Catalogue Maintenance**: Management of geographical destinations and themed categories with referential integrity protection (preventing deletion of active destinations or categories).
- **Itinerary Moderation**: Detailed review panel allowing staff to approve packages or return them with specific correction guidelines visible to the provider.
- **System-wide Reporting**: Aggregated platform metrics, revenue tracking, monthly growth indicators, top-performing packages, and regional distribution summaries.
- **Maintenance Mode Switch**: Platform-wide switch to temporarily redirect public traffic to a maintenance screen while preserving access for authorized administrators.
- **Tamper-Evident Audit Logging**: System actions, configuration changes, and moderation decisions automatically write immutable records containing timestamps, actor identities, targets, and detailed diffs.

---

## Technology Stack

### Frontend
- **Markup**: Semantic HTML5 with accessible elements, native dialogs, and ARIA labels.
- **Styles**: Pure CSS3 utilizing CSS Custom Properties for dynamic theming (Light and Dark mode), responsive flexbox and grid layouts, and zero external style libraries.
- **Scripting**: Standard ECMAScript (Vanilla JS), utilizing modern asynchronous `fetch` calls, standard DOM node generation, and local state management via browser storage.
- **Assets**: Locally stored, optimized imagery to ensure self-contained offline capability.

### Backend
- **Runtime**: Node.js (version 18 LTS or higher recommended).
- **HTTP Engine**: Node's built-in `http` module handling request processing, method routing, and payload delivery.
- **Security**: Cryptographic token generation (`crypto` module) and one-way password hashing (`bcryptjs`).
- **Configuration**: Local environment isolation using `dotenv`.

### Database
- **Engine**: MySQL 8.0 or MariaDB.
- **Driver**: `mysql2` utilizing connection pooling and strict parameterized statement execution.
- **Schema Design**: Normalized relational tables with foreign key cascades, unique constraints, and purpose-built composite performance indexes.

---

## System Design and Business Logic

The application enforces domain logic strictly at the service layer rather than relying on client-side constraints:

1. **Pessimistic Concurrency on Reservations**: When a booking is submitted, the system starts a database transaction and obtains an exclusive row lock (`SELECT ... FOR UPDATE`) on the targeted departure. The service re-computes available capacity against all active bookings (`PENDING` and `CONFIRMED`) before inserting the reservation. This eliminates double-booking scenarios under concurrent loads.
2. **Booking Lifecycle State Machine**:
   - `PENDING`: Reservation placed; departure seats temporarily held pending payment.
   - `CONFIRMED`: Simulated payment completed; seats formally allocated.
   - `COMPLETED`: Automatically marked when the departure date and trip duration elapse via a scheduled background task.
   - `CANCELLED`: Released reservation. If the prior status was `CONFIRMED`, an atomic transaction flips the associated payment record to `REFUNDED` and restores available seat capacity.
3. **Automated Completion Sweep**: An internal timer verifies active departures hourly, marking past trips as `COMPLETED` so that reporting figures and customer review permissions remain consistent without manual administrative overhead.
4. **Platform Maintenance Gating**: When `maintenance_mode` is set to `true`, incoming API traffic is blocked with HTTP status `503 Service Unavailable`, excepting health check endpoints, authentication requests, and requests authenticated as `ADMIN` or `SUPER_ADMIN`.
5. **Secure Authentication Flow**: User authentication issues HMAC-SHA256 tokens carrying the user identity, role, and an expiration timestamp (8 hours). Middleware enforces route permissions server-side, returning HTTP 401 for expired credentials, 403 for insufficient rights, and 429 when brute-force login attempts are detected (5 failed attempts within 10 minutes for an account).

---

## Directory Structure

```
├── backend/
│   ├── config/          # Database connection pool and configuration helpers
│   ├── controllers/     # HTTP request handling and status code management
│   ├── middleware/      # Authentication, role enforcement, and rate limiting
│   ├── routes/          # Custom path-parameter router and endpoint definitions
│   ├── services/        # Business logic, transactional workflows, and SQL queries
│   ├── utils/           # Token signing, response formatting, and validation helpers
│   └── server.js        # Server bootstrap, static file server, and cron initialization
│
├── frontend/
│   ├── assets/img/      # Static visual assets and destination photography
│   ├── css/
│   │   └── style.css    # Central stylesheet with design tokens and dark mode
│   ├── js/              # Modular scripts per page and shared utilities (api.js, auth.js)
│   ├── index.html       # Public landing page with dynamic customer dashboard
│   ├── package.html     # Itinerary detail and interactive departure calendar
│   ├── booking.html     # Guest reservation form with live pricing calculations
│   ├── my-bookings.html # Customer reservation dashboard and cancellation modals
│   ├── provider-*.html  # Tour provider workspace pages
│   ├── admin-*.html     # Platform management and moderation panels
│   └── superadmin-*.html# Super admin governance, logs, and system controls
│
├── database/
│   ├── schema.sql       # Baseline database definitions and table structures
│   ├── seed.sql         # Default categories, initial accounts, and sample tours
│   └── migrations/      # Ordered, incremental schema evolutions (001 through 014)
│
├── tests/
│   └── api.test.js      # Comprehensive end-to-end API test suite
│
├── DEVELOPER.md         # In-depth technical guide, schema details, and endpoint registry
├── package.json         # Project metadata, dependencies, and execution scripts
└── README.md            # Primary project documentation
```

---

## Installation and Setup

### Prerequisites

Ensure the following runtimes are installed on your workstation:
- **Node.js**: Version 18.0.0 or higher (`node -v`)
- **MySQL**: Version 8.0 or MariaDB (`mysql --version`)
- **Git**: For version control management

### Step-by-Step Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd webtech_project
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the sample environment file to create your active configuration:
   ```bash
   cp .env.example .env
   ```
   Open `.env` in your editor and configure your database credentials. Generate a strong token secret using Node's cryptographic utilities:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Paste the output string as your `AUTH_SECRET` in `.env`.

4. **Initialize Database and Permissions**:
   Log into your local MySQL instance as administrative root user and run the initial schema:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   Create a dedicated application user matching your `.env` configuration (do not use root in the application config):
   ```sql
   CREATE USER IF NOT EXISTS 'tourism_user'@'localhost' IDENTIFIED BY 'your_chosen_password';
   GRANT ALL PRIVILEGES ON local_tourism.* TO 'tourism_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

5. **Load Demonstration Data**:
   Populate initial roles, destinations, tour categories, sample itineraries, and verified test profiles:
   ```bash
   mysql -u tourism_user -p local_tourism < database/seed.sql
   ```

6. **Start the Application**:
   ```bash
   # Run standard production server
   npm start

   # Or run with development hot-reloading
   npm run dev
   ```

7. **Verify Connectivity**:
   Open your browser to `http://localhost:3000`. You can also verify backend connectivity by checking `http://localhost:3000/api/health`, which should return a JSON response confirming database connectivity (`"database": "connected"`).

---

## Pre-seeded Demo Accounts

For local demonstration and development, the database seed script generates four ready-to-use profiles covering all security tiers.

| Account Type | Email Address | Password | Intended Test Usage |
|---|---|---|---|
| **Customer** | `customer@example.com` | `Demo@1234` | Browsing packages, reserving departures, simulating payments, managing bookings, submitting reviews. |
| **Tour Provider** | `provider@example.com` | `Demo@1234` | Publishing new itineraries, scheduling departure dates, viewing registered passenger lists, examining revenue reports. |
| **Administrator** | `admin@example.com` | `Demo@1234` | Reviewing pending itineraries, moderating user accounts, curating categories, inspecting general reports. |
| **Super Admin** | `superadmin@example.com` | `Demo@1234` | Creating administrator staff, assigning permissions, managing system settings, inspecting immutable audit logs. |

*Security Warning: These accounts and default credentials exist strictly for offline development. Never use default passwords in staging or production environments.*

---

## Automated Testing

The project includes an end-to-end integration test suite written with zero external test dependencies, utilizing standard Node.js runtime capabilities.

To execute the test suite, ensure the application server is running in an active terminal window, then run:

```bash
npm run test:api
```

The test runner will automatically:
- Verify public destination and package endpoints.
- Test authentication workflows, invalid credentials, and rate-limiting responses.
- Exercise permission gating across Customer, Provider, and Administrator routes.
- Execute complete booking transactions, verifying seat count decrements and locking mechanisms.
- Test refund edge cases and cancellation deadlines.
- Automatically clean up generated test fixtures to preserve a clean database state.

You can also target specific functional modules by supplying a keyword argument:
```bash
node tests/api.test.js moderation
node tests/api.test.js bookings
```

---

## Security Practices

The application integrates standard security controls across all architectural layers:

- **Password Hashing**: Stored credentials use `bcryptjs` with high work factors. Raw passwords and hashed strings are never returned in API payloads.
- **SQL Injection Defense**: Every database query is executed using parameterized statements via `mysql2`. Concatenated SQL strings are strictly prohibited.
- **Cross-Site Scripting (XSS) Mitigation**: User-supplied values rendered onto the DOM are inserted using safe standard properties (`textContent`) and structured document node creation, avoiding raw `innerHTML` injections.
- **Brute Force Protection**: Failed login attempts are tracked in-memory by account and source; five sequential failures trigger a temporary rate-limit freeze (HTTP 429).
- **Directory Traversal Prevention**: The custom static file server normalizes file paths and enforces strict directory sandboxing, blocking malicious dot-dot-slash (`../`) access to operating system files.
- **Sanitized Error Reporting**: Server exceptions log full diagnostics to internal consoles while serving client requests with sanitized, non-revealing error summaries to avoid leaking implementation details.
- **Separation of Privileges**: Database operations use a restricted local MySQL user (`tourism_user`) with permissions bounded strictly to the `local_tourism` database.

---

## Contributing and Team Guidelines

To maintain code cleanliness across the team:

- **Strict Framework Independence**: Do not introduce CSS frameworks (Bootstrap, Tailwind), frontend libraries (React, Vue), or backend abstraction layers (Express, ORMs).
- **Database Migrations**: When updating database structures, create an incremental numbered file in `database/migrations/` (e.g., `015_add_feature_table.sql`) and simultaneously synchronize `database/schema.sql`.
- **Documentation Parity**: Whenever modifying an API endpoint, input validation requirement, or environment setting, immediately document the change in [DEVELOPER.md](DEVELOPER.md).
- **Git Flow**: Develop all additions on dedicated feature branches, keep commits small and descriptive, and submit pull requests for peer review before merging into `main`. Never commit `.env` or sensitive local configuration files.
