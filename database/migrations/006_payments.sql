-- Adds simulated payments (no real gateway): the customer picks a method and confirms with the Pay button.
-- One payment per booking. Safe to re-run.
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('CARD','UPI','NET_BANKING') NOT NULL,
  status ENUM('PAID','REFUNDED') NOT NULL DEFAULT 'PAID',
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB;
