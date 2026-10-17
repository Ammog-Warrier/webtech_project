async function loadPackages() {
  const grid = document.getElementById('packages-grid');
  const select = document.getElementById('destination-filter');
  try {
    // Fill the filter once, then (re)load packages for the selected destination.
    if (select.options.length === 1) {
      const dests = await apiFetch('/destinations');
      dests.forEach((d) => select.append(new Option(d.name, d.id)));
      select.value = new URLSearchParams(location.search).get('destination_id') || '';
    }
    const query = select.value ? `?destination_id=${encodeURIComponent(select.value)}` : '';
    const items = await apiFetch(`/packages${query}`);
    if (!items.length) return showMessage(grid, 'No packages found.');
    grid.replaceChildren(
      ...items.map((p) =>
        card(
          p.image_url,
          p.title,
          { text: `${p.destination_name} · ${p.duration_days} day(s)`, cls: 'muted' },
          { text: p.description },
          { text: `$${Number(p.price).toFixed(2)}`, cls: 'price' }
        )
      )
    );
  } catch (err) {
    showMessage(grid, `Could not load packages: ${err.message}`);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('destination-filter').addEventListener('change', loadPackages);
  loadPackages();
});
