-- Adds provider ownership and moderation status to packages. Run once (not re-runnable on MySQL 8).
-- Existing packages stay APPROVED so the public site keeps working; seed.sql assigns them to the demo provider.
ALTER TABLE packages
  ADD COLUMN provider_id INT UNSIGNED NULL AFTER destination_id,
  ADD COLUMN status ENUM('PENDING','APPROVED','REJECTED','ARCHIVED') NOT NULL DEFAULT 'PENDING' AFTER image_url,
  ADD INDEX idx_packages_provider_status (provider_id, status),
  ADD CONSTRAINT fk_packages_provider FOREIGN KEY (provider_id) REFERENCES users(id);
UPDATE packages SET status = 'APPROVED';
