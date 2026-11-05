
(() => {
  const form = document.getElementById('category-form');
  const rows = document.getElementById('category-rows');
  const formMessage = document.getElementById('form-message');
  const listMessage = document.getElementById('list-message');
  const searchInput = document.getElementById('category-search');
  const idInput = document.getElementById('category-id');
  const nameInput = document.getElementById('category-name');
  const descriptionInput = document.getElementById('category-description');
  const cancelButton = document.getElementById('cancel-edit');

  let categories = [];

  // apiFetch already handles the API URL, authentication and JSON response.
  async function request(path, options = {}) {
    return await apiFetch(path, options);
  }

  // Render categories
  function render() {
    rows.replaceChildren();

    if (!categories.length) {
      listMessage.textContent = 'No categories found.';
      return;
    }

    listMessage.textContent = '';

    categories.forEach((category) => {
      const tr = document.createElement('tr');

      const name = document.createElement('td');
      const description = document.createElement('td');
      const count = document.createElement('td');
      const actions = document.createElement('td');

      name.textContent = category.name;
      description.textContent = category.description || '—';
      count.textContent = String(category.package_count ?? 0);

      // Edit button
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-secondary btn-small';
      edit.textContent = 'Edit';

      edit.addEventListener('click', () => {
        startEdit(category);
      });

      // Delete button
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-danger btn-small';
      remove.textContent = 'Delete';

      remove.addEventListener('click', () => {
        removeCategory(category);
      });

      actions.append(
        edit,
        document.createTextNode(' '),
        remove
      );

      tr.append(name, description, count, actions);
      rows.append(tr);
    });
  }

  // Load categories from backend
  async function loadCategories() {
    listMessage.textContent = 'Loading categories...';

    try {
      const query = new URLSearchParams();

      if (searchInput.value.trim()) {
        query.set('search', searchInput.value.trim());
      }

      const path = `/admin/categories${query.size ? `?${query}` : ''}`;

      categories = await request(path);

      render();
    } catch (error) {
      listMessage.textContent = error.message;
    }
  }

  // Start editing a category
  function startEdit(category) {
    idInput.value = category.id;
    nameInput.value = category.name;
    descriptionInput.value = category.description || '';

    document.getElementById('form-title').textContent = 'Edit category';
    document.getElementById('save-button').textContent = 'Update category';

    cancelButton.hidden = false;
    formMessage.textContent = '';

    nameInput.focus();
  }

  // Reset form
  function resetForm() {
    form.reset();
    idInput.value = '';

    document.getElementById('form-title').textContent = 'Add category';
    document.getElementById('save-button').textContent = 'Save category';

    cancelButton.hidden = true;
  }

  // Create or update category
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = idInput.value;

    const payload = {
      name: nameInput.value.trim(),
      description: descriptionInput.value.trim(),
    };

    try {
      const path = id
        ? `/admin/categories/${id}`
        : '/admin/categories';

      await request(path, {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      formMessage.textContent = id
        ? 'Category updated successfully.'
        : 'Category created successfully.';

      resetForm();
      await loadCategories();

    } catch (error) {
      formMessage.textContent = error.message;
    }
  });

  // Delete category
  async function removeCategory(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      await request(`/admin/categories/${category.id}`, {
        method: 'DELETE',
      });

      await loadCategories();

    } catch (error) {
      window.alert(error.message);
    }
  }

  // Event listeners
  cancelButton.addEventListener('click', resetForm);

  searchInput.addEventListener('input', loadCategories);

  // Authentication
  if (typeof requireAuth === 'function') {
    requireAuth(['ADMIN', 'SUPER_ADMIN']);
  }

  // Initial load
  loadCategories();
})();
