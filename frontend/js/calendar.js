// Month calendar widget. `entries` are { date, end_date, label, status, href, title } where date and end_date
// are YYYY-MM-DD; the first day is marked with the status and the following trip days are lightly shaded.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  return monthKey(new Date(year, number - 1 + delta, 1));
}

function isoDay(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Returns the calendar element. `onMonthChange(newMonth)` is called by the previous / next buttons.
function buildCalendar(month, entries, onMonthChange) {
  const [year, number] = month.split('-').map(Number);
  const monthIndex = number - 1;
  const wrap = el('div', 'calendar');

  const bar = el('div', 'calendar-bar');
  const prev = el('button', 'btn btn-secondary btn-small', '‹ Previous');
  prev.type = 'button';
  prev.addEventListener('click', () => onMonthChange(shiftMonth(month, -1)));
  const next = el('button', 'btn btn-secondary btn-small', 'Next ›');
  next.type = 'button';
  next.addEventListener('click', () => onMonthChange(shiftMonth(month, 1)));
  const title = new Date(year, monthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  bar.append(prev, el('strong', null, title), next);

  const grid = el('div', 'calendar-grid');
  WEEKDAYS.forEach((name) => grid.append(el('div', 'calendar-head', name)));

  const startDays = new Map();
  const tripDays = new Set();
  entries.forEach((entry) => {
    startDays.set(entry.date, entry);
    const end = new Date(`${entry.end_date || entry.date}T00:00:00`);
    for (let d = new Date(`${entry.date}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
      tripDays.add(isoDay(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  });

  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday first
  for (let i = 0; i < offset; i++) grid.append(el('div', 'calendar-cell is-empty'));
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoDay(year, monthIndex, day);
    const entry = startDays.get(iso);
    let cellNode;
    if (entry && entry.href) {
      cellNode = el('a', 'calendar-cell');
      cellNode.href = entry.href;
    } else {
      cellNode = el('div', 'calendar-cell');
    }
    if (entry) {
      cellNode.classList.add('has-entry', `status-${String(entry.status).toLowerCase()}`);
      if (entry.title) cellNode.title = entry.title;
    } else if (tripDays.has(iso)) {
      cellNode.classList.add('in-trip');
    }
    cellNode.append(el('span', 'calendar-day', String(day)));
    if (entry && entry.label) cellNode.append(el('small', null, entry.label));
    grid.append(cellNode);
  }

  wrap.append(bar, grid);
  return wrap;
}
