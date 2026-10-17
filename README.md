# Local Tourism Package Booking System

Framework-free web app: HTML/CSS/vanilla JS frontend, Node.js `http` backend, MySQL.

## Setup
1. Install Node.js 18+ and MySQL 8 (or MariaDB).
2. `npm install`
3. Create the DB user and database:
   ```
   sudo mysql -e "CREATE USER 'tourism_user'@'localhost' IDENTIFIED BY 'change_me';"
   sudo mysql < database/schema.sql
   sudo mysql < database/seed.sql
   sudo mysql -e "GRANT ALL ON local_tourism.* TO 'tourism_user'@'localhost'; FLUSH PRIVILEGES;"
   ```
4. `cp .env.example .env` and set the same password you used above.
5. Start: `npm start` (or `npm run dev` with auto-reload).
6. Open http://localhost:3000 and http://localhost:3000/api/health

## Structure
```
frontend/   public pages, role folders (customer, provider, admin, superadmin), css/, js/, assets/
backend/    server.js, config/, routes/, controllers/, middleware/, services/, utils/
database/   schema.sql, seed.sql, migrations/
```
See `CLAUDE.md` for conventions.
