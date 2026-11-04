USE local_tourism;
INSERT IGNORE INTO roles (name) VALUES ('CUSTOMER'), ('PROVIDER'), ('ADMIN'), ('SUPER_ADMIN');

-- Categories: 009
INSERT IGNORE INTO categories (name, description) VALUES
  ('Adventure', 'Trekking, hiking, outdoor expeditions and high-energy thrills.'),
  ('Cultural', 'Heritage sites, traditional architecture, festivals and local history.'),
  ('Beach & Island', 'Coastal getaways, island hopping, watersports and sunset cruises.'),
  ('Food & Culinary', 'Local street food tours, cooking workshops and farm-to-table experiences.'),
  ('Nature & Wildlife', 'Flora, fauna, nature reserves and eco-tourism trails.');

-- System settings: 009
INSERT INTO settings (setting_key, setting_value, description) VALUES
  ('maintenance_mode', 'false', 'Enable or disable maintenance mode for public routes'),
  ('booking_cancellation_hours_limit', '24', 'Minimum hours prior to departure permitted for booking cancellations')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT IGNORE INTO destinations (name, description, image_url) VALUES
  ('Mountains', 'Alpine trails, scenic viewpoints and village stays.', '/assets/img/mountains.jpg'),
  ('Beaches', 'Sun, sand and fresh seafood along the coast.', '/assets/img/beaches.jpg'),
  ('Cities', 'Local culture, street food and historic quarters.', '/assets/img/cities.jpg');

INSERT IGNORE INTO packages (destination_id, title, description, price, duration_days, image_url)
SELECT d.id, p.title, p.description, p.price, p.days, p.img FROM (
  SELECT 'Mountains' dest, 'Highland Trek Weekend' title, 'Guided two-day trek with a homestay.' description, 120.00 price, 2 days, '/assets/img/mountains.jpg' img
  UNION ALL SELECT 'Mountains', 'Sunrise Peak Hike', 'Early-morning hike to the best viewpoint.', 45.00, 1, '/assets/img/mountains.jpg'
  UNION ALL SELECT 'Beaches', 'Coastal Escape', 'Three relaxing days by the sea.', 210.00, 3, '/assets/img/beaches.jpg'
  UNION ALL SELECT 'Beaches', 'Island Snorkel Day', 'Boat trip and snorkelling with lunch.', 60.00, 1, '/assets/img/beaches.jpg'
  UNION ALL SELECT 'Cities', 'Old Town Food Walk', 'Taste the best local street food.', 35.00, 1, '/assets/img/cities.jpg'
  UNION ALL SELECT 'Cities', 'Heritage City Break', 'Museums, markets and local guides.', 150.00, 2, '/assets/img/cities.jpg'
) p JOIN destinations d ON d.name = p.dest;

-- Assign categories to seeded packages
UPDATE packages SET category_id = (SELECT id FROM categories WHERE name = 'Adventure')
WHERE title IN ('Highland Trek Weekend', 'Sunrise Peak Hike');

UPDATE packages SET category_id = (SELECT id FROM categories WHERE name = 'Beach & Island')
WHERE title IN ('Coastal Escape', 'Island Snorkel Day');

UPDATE packages SET category_id = (SELECT id FROM categories WHERE name = 'Food & Culinary')
WHERE title = 'Old Town Food Walk';

UPDATE packages SET category_id = (SELECT id FROM categories WHERE name = 'Cultural')
WHERE title = 'Heritage City Break';

-- Package details (itinerary / inclusions: one item per line). Safe to re-run.
UPDATE packages SET max_group_size = 10,
  itinerary = 'Day 1: Drive to the trailhead and trek to the highland village\nDay 2: Sunrise walk, breakfast and descent',
  inclusions = 'Local guide\nHomestay and meals\nTrail permits'
WHERE title = 'Highland Trek Weekend';
UPDATE packages SET max_group_size = 15,
  itinerary = 'Day 1: Pre-dawn pickup, guided hike to the peak, breakfast at the summit',
  inclusions = 'Local guide\nBreakfast\nTorch hire'
WHERE title = 'Sunrise Peak Hike';
UPDATE packages SET max_group_size = 12,
  itinerary = 'Day 1: Arrival and beach evening\nDay 2: Free day, optional water sports\nDay 3: Seafood lunch and departure',
  inclusions = 'Beachside stay (2 nights)\nBreakfast daily\nAirport transfers'
WHERE title = 'Coastal Escape';
UPDATE packages SET max_group_size = 20,
  itinerary = 'Day 1: Boat to the island, guided snorkelling, beach lunch, return by evening',
  inclusions = 'Boat transfers\nSnorkel gear\nLunch'
WHERE title = 'Island Snorkel Day';
UPDATE packages SET max_group_size = 8,
  itinerary = 'Day 1: Walk through five street-food stops with a local guide',
  inclusions = 'Local guide\nAll tastings'
WHERE title = 'Old Town Food Walk';
UPDATE packages SET max_group_size = 12,
  itinerary = 'Day 1: Old quarter and museum visit\nDay 2: Market tour and heritage monuments',
  inclusions = 'Local guide\nMuseum tickets\nCity hotel (1 night)'
WHERE title = 'Heritage City Break';

-- Demo accounts, one per role (development only). Password for all: Demo@1234
INSERT IGNORE INTO users (role_id, full_name, email, password_hash, provider_status)
SELECT r.id, a.full_name, a.email, '$2b$10$vzq5nzldHbMCIYj6sBw1XOFttXjk/9eP1898PfePSztdoHCsxuA6a', a.provider_status
FROM (
  SELECT 'CUSTOMER' role, 'Demo Customer' full_name, 'customer@example.com' email, 'NOT_APPLICABLE' provider_status
  UNION ALL SELECT 'PROVIDER', 'Demo Provider', 'provider@example.com', 'APPROVED'
  UNION ALL SELECT 'ADMIN', 'Demo Admin', 'admin@example.com', 'NOT_APPLICABLE'
  UNION ALL SELECT 'SUPER_ADMIN', 'Demo Super Admin', 'superadmin@example.com', 'NOT_APPLICABLE'
) a JOIN roles r ON r.name = a.role;

-- Seeded packages belong to the demo provider and are already approved.
UPDATE packages SET provider_id = (SELECT id FROM users WHERE email = 'provider@example.com'), status = 'APPROVED'
WHERE provider_id IS NULL;

-- Departures: two per package, only for packages that have none yet (safe to re-run).
INSERT INTO package_departures (package_id, start_date, seats_total)
SELECT p.id, DATE_ADD(CURDATE(), INTERVAL o.days DAY), p.max_group_size
FROM packages p JOIN (SELECT 30 days UNION ALL SELECT 60) o
WHERE NOT EXISTS (SELECT 1 FROM package_departures d WHERE d.package_id = p.id);
