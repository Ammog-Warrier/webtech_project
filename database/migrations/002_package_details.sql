-- Adds detail fields to packages. Run once (not re-runnable on MySQL 8).
-- itinerary and inclusions hold one item per line.
ALTER TABLE packages
  ADD COLUMN itinerary TEXT NULL AFTER description,
  ADD COLUMN inclusions TEXT NULL AFTER itinerary,
  ADD COLUMN max_group_size SMALLINT UNSIGNED NOT NULL DEFAULT 12 AFTER duration_days;
