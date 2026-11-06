// Calendar of the customer's own trips on my-bookings.html.
let tripMonth = monthKey(new Date());

async function renderTripCalendar(container, month) {
  tripMonth = month;
  try {
    const data = await apiFetch(`/bookings/calendar?month=${encodeURIComponent(month)}`);
    const entries = data.bookings.map((b) => ({
      date: b.date,
      end_date: b.end_date,
      status: b.status,
      label: b.package_title,
      title: `${b.package_title} · ${b.status} · ${b.num_guests} guest(s)`,
      href: `/my-bookings.html?highlight=${encodeURIComponent(b.booking_id)}`,
    }));
    const calendar = buildCalendar(data.month, entries, (next) => renderTripCalendar(container, next));
    container.replaceChildren(calendar);
    if (!entries.length) container.append(el('p', 'muted', 'No trips start this month.'));
  } catch (err) {
    showMessage(container, `Could not load your trip calendar: ${err.message}`);
  }
}

function refreshTripCalendar() {
  const container = document.getElementById('trip-calendar');
  if (container) renderTripCalendar(container, tripMonth);
}
