async function loadDestinations() {
  const grid = document.getElementById('destinations-grid');
  try {
    const items = await apiFetch('/destinations');
    if (!items.length) return showMessage(grid, 'No destinations yet.');
    grid.replaceChildren(
      ...items.map((d) => {
        const c = card(d.image_url, d.name, { text: d.description });
        const link = el('a', 'btn btn-primary', 'View packages');
        link.href = `/packages.html?destination_id=${d.id}`;
        c.querySelector('.card-body').append(link);
        return c;
      })
    );
  } catch (err) {
    showMessage(grid, `Could not load destinations: ${err.message}`);
  }
}
document.addEventListener('DOMContentLoaded', loadDestinations);
