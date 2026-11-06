// Departure calendar on the package detail page. Colours show seat availability.
const CALENDAR_LABELS = { AVAILABLE: 'Open', LIMITED: 'Few seats', SOLD_OUT: 'Sold out', PAST: 'Past' };

async function renderPackageCalendar(container, packageId, month) {
  try {
    const data = await apiFetch(`/packages/${encodeURIComponent(packageId)}/calendar?month=${encodeURIComponent(month)}`);
    const entries = data.days.map((day) => {
      const bookable = day.status === 'AVAILABLE' || day.status === 'LIMITED';
      return {
        date: day.date,
        end_date: day.end_date,
        status: day.status,
        label: CALENDAR_LABELS[day.status] || day.status,
        title: `${day.seats_available} of ${day.seats_total} seat(s) left`,
        href: bookable ? `/booking.html?package_id=${encodeURIComponent(packageId)}&departure_id=${encodeURIComponent(day.departure_id)}` : null,
      };
    });
    const calendar = buildCalendar(data.month, entries, (next) => renderPackageCalendar(container, packageId, next));
    const legend = el('p', 'muted small-text', 'Select an open date to book it. Few seats = 25% or fewer left.');
    container.replaceChildren(calendar, legend);
    if (!entries.length) container.append(el('p', 'muted', 'No departures this month. Try the next month.'));
  } catch (err) {
    showMessage(container, `Could not load the calendar: ${err.message}`);
  }
}
