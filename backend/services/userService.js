const { pool } = require('../config/db');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Retrieves full user profile including joined address.
 */
async function getUserProfile(userId) {
  const [userRows] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.provider_status, r.name AS role,
            a.id AS address_id, a.street, a.city, a.state, a.postal_code, a.country
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN addresses a ON a.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!userRows.length) {
    throw httpError(404, 'User not found');
  }

  const u = userRows[0];
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    provider_status: u.provider_status,
    address: u.address_id
      ? {
          id: u.address_id,
          street: u.street,
          city: u.city,
          state: u.state,
          postal_code: u.postal_code,
          country: u.country,
        }
      : null,
  };
}

/**
 * Updates user profile and upserts address using INSERT ... ON DUPLICATE KEY UPDATE.
 */
async function updateUserProfile(userId, { fullName, phone, address }) {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw httpError(400, 'full_name is required');
  }

  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanFullName = fullName.trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Update user info
    await conn.execute(
      `UPDATE users SET full_name = ?, phone = ? WHERE id = ?`,
      [cleanFullName, cleanPhone, userId]
    );

    // 2. Upsert address if address data provided
    if (address && typeof address === 'object') {
      const { street, city, state, postal_code, country } = address;
      if (!street || !city || !postal_code) {
        throw httpError(400, 'street, city, and postal_code are required for address');
      }

      const cleanStreet = String(street).trim();
      const cleanCity = String(city).trim();
      const cleanState = state ? String(state).trim() : null;
      const cleanPostal = String(postal_code).trim();
      const cleanCountry = country ? String(country).trim() : 'India';

      await conn.execute(
        `INSERT INTO addresses (user_id, street, city, state, postal_code, country)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           street = VALUES(street),
           city = VALUES(city),
           state = VALUES(state),
           postal_code = VALUES(postal_code),
           country = VALUES(country)`,
        [userId, cleanStreet, cleanCity, cleanState, cleanPostal, cleanCountry]
      );
    }

    await conn.commit();
    return await getUserProfile(userId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
};

