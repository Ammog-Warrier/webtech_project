-- Migration 011: optional reason shown to the provider when an admin rejects a package
USE local_tourism;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'packages'
    AND COLUMN_NAME = 'rejection_reason'
);

SET @stmt = IF(@col_exists = 0,
  'ALTER TABLE packages ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER status',
  'SELECT 1'
);
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;
