
let allPackages = [];

function renderPackages() {
  const grid = document.getElementById('packages-grid');
  const search = document.getElementById('package-search').value.trim().toLowerCase();
  const sort = document.getElementById('sort-filter').value;

  let filtered = allPackages.filter((p) => {
    const searchableText =
      `${p.title} ${p.description || ''} ${p.destination_name}`.toLowerCase();

    return searchableText.includes(search);
  });

  if (sort === 'price-low') {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === 'price-high') {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sort === 'duration') {
    filtered.sort((a, b) => Number(a.duration_days) - Number(b.duration_days));
  }

  if (!filtered.length) {
    return showMessage(grid, 'No matching packages found.');
  }

  grid.replaceChildren(
    ...filtered.map((p) =>
      card(
        p.image_url,
        p.title,
        {
          text: `${p.destination_name} · ${p.duration_days} day(s)`,
          cls: 'muted'
        },
        { text: p.description },
        { text: `$${Number(p.price).toFixed(2)}`, cls: 'price' },
        { text: 'View details', href: `/package.html?id=${p.id}` }
      )
    )
  );
}

async function loadPackages() {
  const grid = document.getElementById('packages-grid');
  const select = document.getElementById('destination-filter');

  try {
    if (select.options.length === 1) {
      const dests = await apiFetch('/destinations');

      dests.forEach((d) => {
        select.append(new Option(d.name, d.id));
      });

      select.value =
        new URLSearchParams(location.search).get('destination_id') || '';
    }

    const query = select.value
      ? `?destination_id=${encodeURIComponent(select.value)}`
      : '';

    allPackages = await apiFetch(`/packages${query}`);

    renderPackages();
  } catch (err) {
    showMessage(grid, `Could not load packages: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('destination-filter')
    .addEventListener('change', loadPackages);

  document
    .getElementById('package-search')
    .addEventListener('input', renderPackages);

  document
    .getElementById('sort-filter')
    .addEventListener('change', renderPackages);

  loadPackages();
});
