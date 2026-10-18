USE local_tourism;
INSERT IGNORE INTO roles (name) VALUES ('CUSTOMER'), ('PROVIDER'), ('ADMIN'), ('SUPER_ADMIN');

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
