-- Migration 014: indexes for columns the admin lists, reports and log viewer filter on.
-- Safe to re-run (an index that already exists is skipped).
USE local_tourism;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_bookings_status'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE bookings ADD INDEX idx_bookings_status (status)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_bookings_created'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE bookings ADD INDEX idx_bookings_created (created_at)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND INDEX_NAME = 'idx_packages_status'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE packages ADD INDEX idx_packages_status (status)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_status'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE payments ADD INDEX idx_payments_status (status)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = 'idx_audit_logs_created'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE audit_logs ADD INDEX idx_audit_logs_created (created_at)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = 'idx_audit_logs_action'
);
SET @stmt = IF(@idx_exists = 0, 'ALTER TABLE audit_logs ADD INDEX idx_audit_logs_action (action)', 'SELECT 1');
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;
