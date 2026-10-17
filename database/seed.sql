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
