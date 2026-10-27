-- Adds an audit trail of admin / super admin actions. Safe to re-run.
-- user_id is the actor; entity + entity_id say what was changed (e.g. 'package', 12).
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_entity (entity, entity_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
