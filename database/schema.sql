CREATE DATABASE IF NOT EXISTS local_tourism CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE local_tourism;

-- Initial tables only; extend via database/migrations/ as features are built.
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- 001_destinations_packages (packages also includes 002_package_details)
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
  title VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  itinerary TEXT NULL,
  inclusions TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days TINYINT UNSIGNED NOT NULL,
  max_group_size SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_packages_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
) ENGINE=InnoDB;
