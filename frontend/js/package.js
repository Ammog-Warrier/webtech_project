function listSection(title, items) {
  const wrap = el('div');
  const list = el('ul');
  items.forEach((item) => list.append(el('li', null, item)));
  wrap.append(el('h3', null, title), list);
  return wrap;
}

function renderDeparturesSection(packageId, departures) {
  const wrap = el('div');
  wrap.append(el('h3', null, 'Upcoming Departures'));

  if (!departures.length) {
    wrap.append(el('p', 'muted', 'No upcoming departures scheduled for this package.'));
    return wrap;
  }

  const list = el('div', 'departure-list');
  departures.forEach((dep) => {
    const item = el('div', 'departure-item');
    if (dep.seats_available <= 0) item.classList.add('sold-out');

    const left = el('div');
    const dateText = el('strong', null, dep.start_date);
    const seatsInfo = el(
      'p',
      'muted',
      dep.seats_available > 0
        ? `${dep.seats_available} of ${dep.seats_total} seat(s) available`
        : 'Sold Out'
    );
    left.append(dateText, seatsInfo);

    const right = el('div');
    if (dep.seats_available > 0) {
      const bookBtn = el('a', 'btn btn-primary', 'Book Date');
      bookBtn.href = `/booking.html?package_id=${encodeURIComponent(packageId)}&departure_id=${encodeURIComponent(dep.id)}`;
      right.append(bookBtn);
    } else {
      const soldOutBadge = el('span', 'badge badge-cancelled', 'Sold Out');
      right.append(soldOutBadge);
    }

    item.append(left, right);
    list.append(item);
  });

  wrap.append(list);
  return wrap;
}

async function loadPackage() {
  const container = document.getElementById('package-detail');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showMessage(container, 'No package selected.');
  try {
    const [p, departures] = await Promise.all([
      apiFetch(`/packages/${encodeURIComponent(id)}`),
      apiFetch(`/packages/${encodeURIComponent(id)}/departures`).catch(() => []),
    ]);

    document.title = `${p.title} · Local Tourism`;
    const img = el('img');
    img.src = p.image_url;
    img.alt = p.title;

    const info = el('div');
    info.append(
      el('h2', null, p.title),
      el('p', 'muted', `${p.destination_name} · ${p.duration_days} day(s) · max group ${p.max_group_size}`),
      el('p', null, p.description),
      el('p', 'price', `$${Number(p.price).toFixed(2)} / guest`)
    );

    if (p.itinerary && p.itinerary.length) info.append(listSection('Itinerary', p.itinerary));
    if (p.inclusions && p.inclusions.length) info.append(listSection('Included', p.inclusions));

    // Departures & Book button
    info.append(renderDeparturesSection(p.id, departures));

    const generalBookBtn = el('a', 'btn btn-primary', 'Book This Package');
    generalBookBtn.href = `/booking.html?package_id=${encodeURIComponent(p.id)}`;
    generalBookBtn.classList.add('book-package-btn');
    info.append(generalBookBtn);

    const saved = await loadWishlistIds();
    if (saved) {
      const heart = wishlistButton(p.id, saved);
      heart.classList.add('wishlist-inline');
      info.append(heart);
    }

    const layout = el('div', 'detail');
    layout.append(img, info);
    container.replaceChildren(layout);
  } catch (err) {
    showMessage(container, `Could not load package: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadPackage);
