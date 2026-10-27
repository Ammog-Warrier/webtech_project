-- Adds account status and provider approval to users. Run once (not re-runnable on MySQL 8).
-- provider_status is only meaningful for PROVIDER accounts; everyone else stays NOT_APPLICABLE.
ALTER TABLE users
  ADD COLUMN phone VARCHAR(20) NULL AFTER email,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash,
  ADD COLUMN provider_status ENUM('NOT_APPLICABLE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_APPLICABLE' AFTER is_active;
