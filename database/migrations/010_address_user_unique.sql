-- Migration 010: Ensure unique address per user for upsert operations
USE local_tourism;

-- Safely add UNIQUE constraint on user_id in addresses if it does not already exist
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'addresses'
    AND INDEX_NAME = 'uq_addresses_user'
);

SET @stmt = IF(@idx_exists = 0,
  'ALTER TABLE addresses ADD CONSTRAINT uq_addresses_user UNIQUE (user_id)',
  'SELECT 1'
);
PREPARE run_stmt FROM @stmt;
EXECUTE run_stmt;
DEALLOCATE PREPARE run_stmt;

