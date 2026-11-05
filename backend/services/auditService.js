const { pool } = require('../config/db');

// Writes one row to audit_logs. Pass a transaction connection as `db` to log inside it.
// Logging is best effort: a failure is reported on the server console but never breaks the action.
async function logAction(userId, action, entity, entityId, details, db = pool) {
  try {
    await db.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [
        userId,
        String(action).slice(0, 50),
        String(entity).slice(0, 50),
        entityId === undefined || entityId === null ? null : Number(entityId),
        details === undefined || details === null ? null : String(details).slice(0, 255),
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAction };
