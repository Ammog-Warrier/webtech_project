const { pool } = require('../config/db');

async function listDestinations() {
  const [rows] = await pool.execute(
    'SELECT id, name, description, image_url FROM destinations ORDER BY name'
  );
  return rows;
}

module.exports = { listDestinations };
