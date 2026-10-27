-- Adds bookable departures (with seat capacity) and customer bookings. Safe to re-run.
CREATE TABLE IF NOT EXISTS package_departures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  seats_total SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_departures_package_date (package_id, start_date),
  CONSTRAINT fk_departures_package FOREIGN KEY (package_id) REFERENCES packages(id)
) ENGINE=InnoDB;

-- total_price is a snapshot of price x num_guests at booking time.
CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  departure_id INT UNSIGNED NOT NULL,
  num_guests SMALLINT UNSIGNED NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bookings_customer (customer_id),
  INDEX idx_bookings_departure (departure_id),
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_departure FOREIGN KEY (departure_id) REFERENCES package_departures(id)
) ENGINE=InnoDB;
