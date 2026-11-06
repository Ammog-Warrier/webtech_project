async function loadWishlist() {
  const grid = document.getElementById('wishlist-grid');
  try {
    const items = await apiFetch('/wishlist');
    if (!items.length) {
      grid.replaceChildren();
      const empty = el('div', 'form-card empty-state');
      empty.append(el('h3', null, 'Nothing saved yet'), el('p', 'muted', 'Tap the heart on a package to save it here.'));
      const link = el('a', 'btn btn-primary', 'Browse packages');
      link.href = '/packages.html';
      empty.append(link);
      grid.append(empty);
      return;
    }
    const saved = new Set(items.map((item) => item.package_id));
    grid.replaceChildren(...items.map((p) => {
      const article = card(
        p.image_url,
        p.title,
        { text: `${p.destination_name} · ${p.duration_days} day(s)${p.category_name ? ` · ${p.category_name}` : ''}`, cls: 'muted' },
        { text: `$${Number(p.price).toFixed(2)}`, cls: 'price' },
        { text: 'View details', href: `/package.html?id=${p.id || p.package_id}` }
      );
      article.querySelector('.card-body').append(wishlistButton(p.package_id, saved, () => {
        article.remove();
        if (!grid.children.length) loadWishlist();
      }));
      return article;
    }));
  } catch (err) {
    showMessage(grid, `Could not load your wishlist: ${err.message}`);
  }
}

guardPage(['CUSTOMER']).then((user) => { if (user) loadWishlist(); });
