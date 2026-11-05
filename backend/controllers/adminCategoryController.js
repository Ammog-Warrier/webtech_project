const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../services/adminCategoryService');
const { logAction } = require('../services/auditService');
const { parseJsonBody } = require('../utils/body');
const { ok, fail } = require('../utils/response');

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function validateCategory(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string'
    ? body.description.trim()
    : '';

  if (!name || name.length > 100) {
    return { error: 'Name is required and must be at most 100 characters.' };
  }
  if (description.length > 5000) {
    return { error: 'Description must be at most 5000 characters.' };
  }
  return { value: { name, description } };
}

async function getAdminCategories(req, res) {
  try {
    const search = typeof req.query?.search === 'string'
      ? req.query.search.trim().slice(0, 100)
      : '';
    const rows = await getCategories(search);
    return ok(res, rows);
  } catch (error) {
    console.error('Admin categories list error:', error);
    return fail(res, 500, 'Unable to load categories.');
  }
}

async function getAdminCategoryDetails(req, res) {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'Invalid category ID.');
    const category = await getCategoryById(Number(req.params.id));
    if (!category) return fail(res, 404, 'Category not found.');
    return ok(res, category);
  } catch (error) {
    console.error('Admin category details error:', error);
    return fail(res, 500, 'Unable to load category.');
  }
}

async function createAdminCategory(req, res) {
  try {
    const validation = validateCategory(await parseJsonBody(req));
    if (validation.error) return fail(res, 400, validation.error);

    const category = await createCategory(validation.value);
    await logAction(req.user.id, 'CATEGORY_CREATED', 'categories', category.id, category.name);
    return ok(res, category, 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'A category with this name already exists.');
    }
    console.error('Admin category create error:', error);
    return fail(res, 500, 'Unable to create category.');
  }
}

async function updateAdminCategory(req, res) {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'Invalid category ID.');
    const validation = validateCategory(await parseJsonBody(req));
    if (validation.error) return fail(res, 400, validation.error);

    const existing = await getCategoryById(Number(req.params.id));
    if (!existing) return fail(res, 404, 'Category not found.');

    await updateCategory(Number(req.params.id), validation.value);
    await logAction(req.user.id, 'CATEGORY_UPDATED', 'categories', Number(req.params.id), validation.value.name);
    return ok(res, await getCategoryById(Number(req.params.id)));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'A category with this name already exists.');
    }
    console.error('Admin category update error:', error);
    return fail(res, 500, 'Unable to update category.');
  }
}

async function deleteAdminCategory(req, res) {
  try {
    if (!validId(req.params.id)) return fail(res, 400, 'Invalid category ID.');
    const category = await getCategoryById(Number(req.params.id));
    if (!category) return fail(res, 404, 'Category not found.');
    if (Number(category.package_count) > 0) {
      return fail(res, 409, 'This category is linked to packages and cannot be deleted.');
    }
    await deleteCategory(Number(req.params.id));
    await logAction(req.user.id, 'CATEGORY_DELETED', 'categories', Number(req.params.id), category.name);
    return ok(res, { message: 'Category deleted successfully.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_NO_REFERENCED_ROW_2') {
      return fail(res, 409, 'This category is linked to packages and cannot be deleted.');
    }
    console.error('Admin category delete error:', error);
    return fail(res, 500, 'Unable to delete category.');
  }
}

module.exports = {
  getAdminCategories,
  getAdminCategoryDetails,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
};
