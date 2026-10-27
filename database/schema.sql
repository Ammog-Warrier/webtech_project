CREATE DATABASE IF NOT EXISTS local_tourism CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE local_tourism;

-- Full schema (migrations 001-008 applied). Extend via database/migrations/ as features are built.
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  provider_status ENUM('NOT_APPLICABLE','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_APPLICABLE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- 001_destinations_packages (packages also includes 002_package_details and 004_package_ownership)
CREATE TABLE IF NOT EXISTS destinations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS packages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  destination_id INT UNSIGNED NOT NULL,
  provider_id INT UNSIGNED NULL,
  title VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  itinerary TEXT NULL,
  inclusions TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days TINYINT UNSIGNED NOT NULL,
  max_group_size SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  image_url VARCHAR(255) NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','ARCHIVED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_packages_provider_status (provider_id, status),
  CONSTRAINT fk_packages_destination FOREIGN KEY (destination_id) REFERENCES destinations(id),
  CONSTRAINT fk_packages_provider FOREIGN KEY (provider_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 005_departures_bookings
CREATE TABLE IF NOT EXISTS package_departures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  seats_total SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_departures_package_date (package_id, start_date),
  CONSTRAINT fk_departures_package FOREIGN KEY (package_id) REFERENCES packages(id)
) ENGINE=InnoDB;

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

-- 006_payments
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('CARD','UPI','NET_BANKING') NOT NULL,
  status ENUM('PAID','REFUNDED') NOT NULL DEFAULT 'PAID',
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB;

-- 007_reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL UNIQUE,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB;

-- 008_audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_entity (entity, entity_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
