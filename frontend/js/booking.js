let currentPackage = null;
let currentDepartures = [];

async function initBookingPage() {
  const container = document.getElementById('booking-container');
  const params = new URLSearchParams(location.search);
  const packageId = params.get('package_id');
  const preselectedDepartureId = params.get('departure_id');

  if (!packageId) {
    showMessage(container, 'No package specified for booking.');
    return;
  }

  // Auth check: require customer login
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  const user = typeof getStoredUser === 'function' ? getStoredUser() : null;
  if (!token || !user) {
    window.location.replace(`/login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  if (user.role && user.role !== 'CUSTOMER') {
    showMessage(container, 'Only customer accounts can make bookings. Please sign in with a customer account.');
    return;
  }

  try {
    const [pkg, departures] = await Promise.all([
      apiFetch(`/packages/${encodeURIComponent(packageId)}`),
      apiFetch(`/packages/${encodeURIComponent(packageId)}/departures`),
    ]);

    currentPackage = pkg;
    currentDepartures = departures;

    renderBookingForm(container, preselectedDepartureId);
  } catch (err) {
    showMessage(container, `Failed to load booking details: ${err.message}`);
  }
}

function renderBookingForm(container, preselectedDepartureId) {
  container.replaceChildren();

  const card = el('div', 'form-card');
  const header = el('div');
  header.append(
    el('a', 'muted', '← Back to package'),
    el('h2', null, `Book: ${currentPackage.title}`),
    el('p', 'muted', `${currentPackage.destination_name} · $${Number(currentPackage.price).toFixed(2)} per person`)
  );
  header.querySelector('a').href = `/package.html?id=${encodeURIComponent(currentPackage.id)}`;
  header.querySelector('a').style.display = 'inline-block';
  header.querySelector('a').style.marginBottom = '0.75rem';

  const form = el('form');
  form.id = 'booking-form';

  // Departure date selection
  const depGroup = el('div', 'form-group');
  depGroup.append(el('label', null, 'Select Departure Date'));
  const depSelect = el('select');
  depSelect.name = 'departure_id';
  depSelect.required = true;

  const defaultOption = el('option', null, '-- Choose a departure date --');
  defaultOption.value = '';
  depSelect.append(defaultOption);

  let validDeparturesCount = 0;
  currentDepartures.forEach((dep) => {
    const opt = el('option');
    opt.value = dep.id;
    opt.dataset.seats = dep.seats_available;
    if (dep.seats_available > 0) {
      opt.textContent = `${dep.start_date} (${dep.seats_available} seats remaining)`;
      validDeparturesCount++;
    } else {
      opt.textContent = `${dep.start_date} (SOLD OUT)`;
      opt.disabled = true;
    }
    if (preselectedDepartureId && String(dep.id) === String(preselectedDepartureId) && dep.seats_available > 0) {
      opt.selected = true;
    }
    depSelect.append(opt);
  });

  depGroup.append(depSelect);

  // Guests count selection
  const guestsGroup = el('div', 'form-group');
  guestsGroup.append(el('label', null, 'Number of Guests'));
  const guestInput = el('input');
  guestInput.type = 'number';
  guestInput.name = 'num_guests';
  guestInput.min = '1';
  guestInput.max = String(currentPackage.max_group_size || 12);
  guestInput.value = '1';
  guestInput.required = true;
  guestsGroup.append(guestInput);

  // Live price calculation box
  const priceBox = el('div', 'price-summary-box');
  const unitRow = el('div', 'price-summary-row');
  unitRow.append(el('span', null, 'Price per person:'), el('span', null, `$${Number(currentPackage.price).toFixed(2)}`));

  const countRow = el('div', 'price-summary-row');
  const countSpan = el('span', null, '1');
  countRow.append(el('span', null, 'Number of guests:'), countSpan);

  const totalRow = el('div', 'price-summary-row price-summary-total');
  const totalSpan = el('span', null, `$${Number(currentPackage.price).toFixed(2)}`);
  totalRow.append(el('span', null, 'Total Price:'), totalSpan);

  priceBox.append(unitRow, countRow, totalRow);

  function updatePrice() {
    const guests = Math.max(1, parseInt(guestInput.value, 10) || 1);
    countSpan.textContent = String(guests);
    const total = (Number(currentPackage.price) * guests).toFixed(2);
    totalSpan.textContent = `$${total}`;

    const selectedOpt = depSelect.options[depSelect.selectedIndex];
    if (selectedOpt && selectedOpt.dataset.seats) {
      const available = parseInt(selectedOpt.dataset.seats, 10);
      guestInput.max = String(Math.min(available, currentPackage.max_group_size));
    }
  }

  depSelect.addEventListener('change', updatePrice);
  guestInput.addEventListener('input', updatePrice);

  // Submit button & status feedback
  const feedback = el('div', 'alert');
  feedback.style.display = 'none';

  const submitBtn = el('button', 'btn btn-primary', 'Confirm & Create Booking');
  submitBtn.type = 'submit';
  submitBtn.style.width = '100%';
  submitBtn.style.marginTop = '1rem';

  if (validDeparturesCount === 0) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'No Departures Available';
  }

  form.append(depGroup, guestsGroup, priceBox, feedback, submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.style.display = 'none';

    const depId = depSelect.value;
    const numGuests = parseInt(guestInput.value, 10);

    if (!depId) {
      feedback.className = 'alert alert-error';
      feedback.textContent = 'Please select a departure date';
      feedback.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Reserving seats…';

    try {
      const booking = await apiFetch('/bookings', {
        method: 'POST',
        body: {
          departure_id: Number(depId),
          num_guests: numGuests,
        },
      });

      // Redirect to My Bookings with prompt to pay
      window.location.replace(`/my-bookings.html?highlight=${encodeURIComponent(booking.id)}`);
    } catch (err) {
      feedback.className = 'alert alert-error';
      feedback.textContent = err.message || 'Failed to create booking';
      feedback.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Create Booking';
    }
  });

  card.append(header, form);
  container.append(card);
  updatePrice();
}

document.addEventListener('DOMContentLoaded', initBookingPage);
