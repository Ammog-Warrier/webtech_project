const { pool } = require('../config/db');
async function getCategories(search = '') {
  const term = `%${search}%`;
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, c.description, c.created_at,
            COUNT(p.id) AS package_count
     FROM categories c
     LEFT JOIN packages p ON p.category_id = c.id
     WHERE c.name LIKE ? OR c.description LIKE ?
     GROUP BY c.id, c.name, c.description, c.created_at
     ORDER BY c.name ASC`,
    [term, term]
  );
  return rows;
}

async function getCategoryById(id) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, c.description, c.created_at,
            COUNT(p.id) AS package_count
     FROM categories c
     LEFT JOIN packages p ON p.category_id = c.id
     WHERE c.id = ?
     GROUP BY c.id, c.name, c.description, c.created_at`,
    [id]
  );
  return rows[0] || null;
}

async function createCategory({ name, description }) {
  const [result] = await pool.execute(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [name, description]
  );
  return getCategoryById(result.insertId);
}

async function updateCategory(id, { name, description }) {
  await pool.execute(
    'UPDATE categories SET name = ?, description = ? WHERE id = ?',
    [name, description, id]
  );
  return getCategoryById(id);
}

async function deleteCategory(id) {
  const [result] = await pool.execute(
    'DELETE FROM categories WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
