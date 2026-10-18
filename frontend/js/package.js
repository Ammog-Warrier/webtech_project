function listSection(title, items) {
  const wrap = el('div');
  const list = el('ul');
  items.forEach((item) => list.append(el('li', null, item)));
  wrap.append(el('h3', null, title), list);
  return wrap;
}

async function loadPackage() {
  const container = document.getElementById('package-detail');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showMessage(container, 'No package selected.');
  try {
    const p = await apiFetch(`/packages/${encodeURIComponent(id)}`);
    document.title = `${p.title} · Local Tourism`;
    const img = el('img');
    img.src = p.image_url;
    img.alt = p.title;
    const info = el('div');
    info.append(
      el('h2', null, p.title),
      el('p', 'muted', `${p.destination_name} · ${p.duration_days} day(s) · up to ${p.max_group_size} people`),
      el('p', null, p.description),
      el('p', 'price', `$${Number(p.price).toFixed(2)}`)
    );
    if (p.itinerary.length) info.append(listSection('Itinerary', p.itinerary));
    if (p.inclusions.length) info.append(listSection('Included', p.inclusions));
    const layout = el('div', 'detail');
    layout.append(img, info);
    container.replaceChildren(layout);
  } catch (err) {
    showMessage(container, `Could not load package: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadPackage);
