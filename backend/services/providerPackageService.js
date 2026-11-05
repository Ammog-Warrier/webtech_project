const { pool } = require('../config/db');

function toLines(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '').trim();
}

function normalizePackageInput(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const destinationId = Number(body.destination_id);
  const categoryId = body.category_id === '' || body.category_id === null || body.category_id === undefined
    ? null : Number(body.category_id);
  const price = Number(body.price);
  const durationDays = Number(body.duration_days);
  const maxGroupSize = body.max_group_size === undefined || body.max_group_size === ''
    ? 12 : Number(body.max_group_size);
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
  const itinerary = toLines(body.itinerary);
  const inclusions = toLines(body.inclusions);

  if (title.length < 3 || title.length > 150) throw Object.assign(new Error('Title must be 3-150 characters'), { status: 400 });
  if (!description || description.length > 10000) throw Object.assign(new Error('Description is required and must be under 10000 characters'), { status: 400 });
  if (!Number.isInteger(destinationId) || destinationId < 1) throw Object.assign(new Error('Select a valid destination'), { status: 400 });
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) throw Object.assign(new Error('Select a valid category'), { status: 400 });
  if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) throw Object.assign(new Error('Price must be greater than zero'), { status: 400 });
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 255) throw Object.assign(new Error('Duration must be between 1 and 255 days'), { status: 400 });
  if (!Number.isInteger(maxGroupSize) || maxGroupSize < 1 || maxGroupSize > 65535) throw Object.assign(new Error('Maximum group size must be between 1 and 65535'), { status: 400 });
  if (!imageUrl || imageUrl.length > 255) throw Object.assign(new Error('Image URL/path is required and must be under 255 characters'), { status: 400 });
  if (itinerary.length > 10000 || inclusions.length > 10000) throw Object.assign(new Error('Itinerary and inclusions must be under 10000 characters each'), { status: 400 });

  return { title, description, destinationId, categoryId, price, durationDays, maxGroupSize, imageUrl, itinerary, inclusions };
}

async function listProviderPackages(providerId) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.title, p.description, p.price, p.duration_days, p.max_group_size,
            p.image_url, p.destination_id, d.name AS destination_name,
            p.category_id, c.name AS category_name, p.status, p.created_at
       FROM packages p
       JOIN destinations d ON d.id = p.destination_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.provider_id = ?
      ORDER BY p.created_at DESC, p.id DESC`,
    [providerId]
  );
  return rows;
}

async function listPackageFormOptions() {
  const [[destinations], [categories]] = await Promise.all([
    pool.execute('SELECT id, name FROM destinations ORDER BY name'),
    pool.execute('SELECT id, name FROM categories ORDER BY name'),
  ]);
  return { destinations, categories };
}

async function createProviderPackage(providerId, body) {
  const input = normalizePackageInput(body);
  const [result] = await pool.execute(
    `INSERT INTO packages
       (destination_id, category_id, provider_id, title, description, itinerary, inclusions,
        price, duration_days, max_group_size, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [input.destinationId, input.categoryId, providerId, input.title, input.description,
      input.itinerary, input.inclusions, input.price, input.durationDays,
      input.maxGroupSize, input.imageUrl]
  );
  return findOwnedPackage(providerId, result.insertId);
}

async function findOwnedPackage(providerId, packageId) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.title, p.description, p.itinerary, p.inclusions, p.price,
            p.duration_days, p.max_group_size, p.image_url, p.destination_id,
            p.category_id, p.status
       FROM packages p WHERE p.id = ? AND p.provider_id = ?`,
    [packageId, providerId]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function updateProviderPackage(providerId, packageId, body) {
  const input = normalizePackageInput(body);
  const existing = await findOwnedPackage(providerId, packageId);
  if (!existing) return null;

  // Any content edit requires moderation again, including edits to previously approved packages.
  await pool.execute(
    `UPDATE packages
        SET destination_id = ?, category_id = ?, title = ?, description = ?,
            itinerary = ?, inclusions = ?, price = ?, duration_days = ?,
            max_group_size = ?, image_url = ?, status = 'PENDING'
      WHERE id = ? AND provider_id = ?`,
    [input.destinationId, input.categoryId, input.title, input.description,
      input.itinerary, input.inclusions, input.price, input.durationDays,
      input.maxGroupSize, input.imageUrl, packageId, providerId]
  );
  return findOwnedPackage(providerId, packageId);
}

async function archiveProviderPackage(providerId, packageId) {
  const [result] = await pool.execute(
    `UPDATE packages SET status = 'ARCHIVED'
      WHERE id = ? AND provider_id = ? AND status <> 'ARCHIVED'`,
    [packageId, providerId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  listProviderPackages,
  listPackageFormOptions,
  createProviderPackage,
  updateProviderPackage,
  archiveProviderPackage,
};
