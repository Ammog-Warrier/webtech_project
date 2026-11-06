// Wishlist helpers shared by the packages list, the package detail page and wishlist.html.
// Only customers have a wishlist; for everyone else these helpers do nothing.
function isCustomerSession() {
  const user = typeof getStoredUser === 'function' ? getStoredUser() : null;
  return Boolean(getToken() && user && user.role === 'CUSTOMER');
}

// Returns a Set of saved package ids, or null when the visitor is not a customer.
async function loadWishlistIds() {
  if (!isCustomerSession()) return null;
  try {
    const items = await apiFetch('/wishlist');
    return new Set(items.map((item) => item.package_id));
  } catch (err) {
    return null;
  }
}

// A heart toggle button. `saved` is the shared Set; `onChange(packageId, isSaved)` runs after a successful change.
function wishlistButton(packageId, saved, onChange) {
  const btn = el('button', 'wishlist-btn');
  btn.type = 'button';
  const paint = () => {
    const isSaved = saved.has(packageId);
    btn.textContent = isSaved ? '♥ Saved' : '♡ Save';
    btn.classList.toggle('is-saved', isSaved);
    btn.setAttribute('aria-pressed', String(isSaved));
    btn.title = isSaved ? 'Remove from wishlist' : 'Save to wishlist';
  };
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const wasSaved = saved.has(packageId);
    try {
      if (wasSaved) {
        await apiFetch(`/wishlist/${encodeURIComponent(packageId)}`, { method: 'DELETE' });
        saved.delete(packageId);
      } else {
        await apiFetch('/wishlist', { method: 'POST', body: { package_id: packageId } });
        saved.add(packageId);
      }
      paint();
      if (onChange) onChange(packageId, saved.has(packageId));
    } catch (err) {
      btn.title = err.message;
      btn.classList.add('has-error');
    } finally {
      btn.disabled = false;
    }
  });
  paint();
  return btn;
}
