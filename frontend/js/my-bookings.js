let cachedBookings = [];

async function initMyBookingsPage() {
  const container = document.getElementById('bookings-list');

  // Auth guard: customer only
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  const user = typeof getStoredUser === 'function' ? getStoredUser() : null;
  if (!token || !user) {
    window.location.replace(`/login.html?redirect=${encodeURIComponent(location.pathname)}`);
    return;
  }
  if (user.role && user.role !== 'CUSTOMER') {
    showMessage(container, 'This area is for customers to view personal bookings.');
    return;
  }

  await loadBookings();
}

async function loadBookings() {
  const container = document.getElementById('bookings-list');
  try {
    const bookings = await apiFetch('/bookings/my');
    cachedBookings = bookings;
    renderBookings(container, bookings);
  } catch (err) {
    showMessage(container, `Could not load your bookings: ${err.message}`);
  }
}

function renderBookings(container, bookings) {
  if (!bookings.length) {
    container.replaceChildren();
    const emptyBox = el('div', 'form-card empty-state');
    emptyBox.append(
      el('h3', null, 'No bookings yet'),
      el('p', 'muted', 'You have not booked any tours or experiences yet.'),
      el('a', 'btn btn-primary', 'Browse Packages')
    );
    emptyBox.querySelector('a').href = '/packages.html';
    container.append(emptyBox);
    return;
  }

  const highlightId = new URLSearchParams(location.search).get('highlight');
  const grid = el('div', 'booking-grid');

  bookings.forEach((b) => {
    const card = el('div', 'booking-card');
    if (highlightId && String(b.id) === String(highlightId)) {
      card.classList.add('is-highlighted');
    }

    const img = el('img', 'booking-card-img');
    img.src = b.package_image;
    img.alt = b.package_title;

    const body = el('div', 'booking-card-body');

    // Header: Title & Status Badge
    const header = el('div', 'booking-card-header');
    const title = el('h3', null, b.package_title);
    title.classList.add('booking-title');

    let badgeClass = 'badge-pending';
    if (b.status === 'CONFIRMED') badgeClass = 'badge-confirmed';
    if (b.status === 'COMPLETED') badgeClass = 'badge-completed';
    if (b.status === 'CANCELLED') badgeClass = 'badge-cancelled';

    const badge = el('span', `badge ${badgeClass}`, b.status);
    header.append(title, badge);

    // Details
    const meta = el('p', 'muted');
    meta.textContent = `${b.destination_name} · Departure: ${b.departure_date} · ${b.num_guests} guest(s)`;

    const priceRow = el('div', 'price-summary-row');
    priceRow.append(
      el('span', 'muted', `Booked: ${b.created_at}`),
      el('strong', 'price', `$${Number(b.total_price).toFixed(2)}`)
    );

    body.append(header, meta, priceRow);

    // Payment Info snippet
    if (b.payment_status) {
      const payInfo = el('p', 'muted small-text');
      payInfo.append('Payment: ', el('strong', null, b.payment_status), ` (${b.payment_method || 'N/A'})`);
      body.append(payInfo);
    }

    // Review snippet
    if (b.review_id) {
      const reviewBox = el('div', 'review-box small-text');
      const stars = '★'.repeat(b.review_rating) + '☆'.repeat(5 - b.review_rating);
      reviewBox.append(el('span', 'review-stars', stars));
      if (b.review_comment) reviewBox.append(` "${b.review_comment}"`);
      body.append(reviewBox);
    }

    // Actions
    const actions = el('div', 'booking-card-actions');

    if (b.status === 'PENDING') {
      const payBtn = el('button', 'btn btn-primary', 'Pay Now (Simulated)');
      payBtn.type = 'button';
      payBtn.addEventListener('click', () => openPaymentModal(b));
      actions.append(payBtn);

      const cancelBtn = el('button', 'btn btn-secondary', 'Cancel Booking');
      cancelBtn.type = 'button';
      cancelBtn.addEventListener('click', () => confirmCancellation(b));
      actions.append(cancelBtn);
    } else if (b.status === 'CONFIRMED') {
      const cancelBtn = el('button', 'btn btn-secondary', 'Cancel & Refund');
      cancelBtn.type = 'button';
      cancelBtn.addEventListener('click', () => confirmCancellation(b));
      actions.append(cancelBtn);
    }

    if (b.review_eligible) {
      const reviewBtn = el('button', 'btn btn-primary', 'Write Review');
      reviewBtn.type = 'button';
      reviewBtn.addEventListener('click', () => openReviewModal(b));
      actions.append(reviewBtn);
    }

    const viewPkgBtn = el('a', 'btn btn-secondary', 'View Tour');
    viewPkgBtn.href = `/package.html?id=${encodeURIComponent(b.package_id)}`;
    actions.append(viewPkgBtn);

    body.append(actions);
    card.append(img, body);
    grid.append(card);
  });

  container.replaceChildren(grid);
}

// Payment modal
function openPaymentModal(booking) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.replaceChildren();

  const backdrop = el('div', 'modal-backdrop');
  const dialog = el('div', 'modal-dialog');

  dialog.append(
    el('h3', null, 'Simulated Payment'),
    el('p', 'muted', `Booking #${booking.id} - ${booking.package_title}`),
    el('p', 'price', `Amount to pay: $${Number(booking.total_price).toFixed(2)}`)
  );

  const form = el('form');
  form.classList.add('modal-form');

  const methodGroup = el('div', 'form-group');
  methodGroup.append(el('label', null, 'Select Payment Method'));
  const select = el('select');
  [['CARD', 'Credit / Debit Card (Simulated)'], ['UPI', 'UPI / Instant Pay (Simulated)'], ['NET_BANKING', 'Net Banking (Simulated)']]
    .forEach(([value, label]) => {
      const option = el('option', null, label);
      option.value = value;
      select.append(option);
    });
  methodGroup.append(select);

  const note = el('p', 'muted small-text');
  note.textContent = 'Note: This is a simulation. No real card details are entered, stored, or processed.';

  const feedback = el('div', 'alert');
  feedback.style.display = 'none';

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn btn-secondary', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => modalContainer.replaceChildren());

  const payBtn = el('button', 'btn btn-primary', 'Confirm Payment');
  payBtn.type = 'submit';

  actions.append(cancelBtn, payBtn);
  form.append(methodGroup, note, feedback, actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    feedback.style.display = 'none';

    try {
      await apiFetch(`/bookings/${encodeURIComponent(booking.id)}/pay`, {
        method: 'POST',
        body: { method: select.value },
      });
      modalContainer.replaceChildren();
      showAlert('Payment successful! Your booking is now CONFIRMED.', 'alert-success');
      await loadBookings();
    } catch (err) {
      feedback.className = 'alert alert-error';
      feedback.textContent = err.message || 'Payment failed';
      feedback.style.display = 'block';
      payBtn.disabled = false;
      payBtn.textContent = 'Confirm Payment';
    }
  });

  dialog.append(form);
  backdrop.append(dialog);
  modalContainer.append(backdrop);
}

// Cancellation confirmation
function confirmCancellation(booking) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.replaceChildren();

  const backdrop = el('div', 'modal-backdrop');
  const dialog = el('div', 'modal-dialog');

  dialog.append(
    el('h3', null, 'Confirm Cancellation'),
    el('p', null, `Are you sure you want to cancel your reservation for "${booking.package_title}" on ${booking.departure_date}?`),
    el('p', 'muted', booking.status === 'CONFIRMED'
      ? 'A full simulated refund will be issued to your payment method.'
      : 'Your pending reservation and held seats will be released.')
  );

  const feedback = el('div', 'alert');
  feedback.style.display = 'none';
  feedback.style.marginTop = '1rem';

  const actions = el('div', 'modal-actions');
  const noBtn = el('button', 'btn btn-secondary', 'Keep Booking');
  noBtn.type = 'button';
  noBtn.addEventListener('click', () => modalContainer.replaceChildren());

  const yesBtn = el('button', 'btn btn-danger', 'Yes, Cancel Reservation');
  yesBtn.type = 'button';
  yesBtn.addEventListener('click', async () => {
    yesBtn.disabled = true;
    yesBtn.textContent = 'Cancelling…';
    feedback.style.display = 'none';

    try {
      const res = await apiFetch(`/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'POST',
      });
      modalContainer.replaceChildren();
      const msg = res.refundIssued
        ? 'Booking cancelled and simulated refund recorded.'
        : 'Booking cancelled successfully.';
      showAlert(msg, 'alert-success');
      await loadBookings();
    } catch (err) {
      feedback.className = 'alert alert-error';
      feedback.textContent = err.message || 'Failed to cancel booking';
      feedback.style.display = 'block';
      yesBtn.disabled = false;
      yesBtn.textContent = 'Yes, Cancel Reservation';
    }
  });

  actions.append(noBtn, yesBtn);
  dialog.append(feedback, actions);
  backdrop.append(dialog);
  modalContainer.append(backdrop);
}

// Review modal
function openReviewModal(booking) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.replaceChildren();

  const backdrop = el('div', 'modal-backdrop');
  const dialog = el('div', 'modal-dialog');

  dialog.append(
    el('h3', null, 'Rate & Review Tour'),
    el('p', 'muted', `${booking.package_title} (Completed on ${booking.departure_date})`)
  );

  const form = el('form');
  form.classList.add('modal-form');

  let selectedRating = 5;

  const ratingGroup = el('div', 'form-group');
  ratingGroup.append(el('label', null, 'Your Rating (1 to 5 Stars)'));
  const starsContainer = el('div', 'star-rating');
  for (let i = 1; i <= 5; i++) {
    const star = el('span', 'star active', '★');
    star.dataset.value = i;
    star.addEventListener('click', () => {
      selectedRating = i;
      updateStars();
    });
    starsContainer.append(star);
  }

  function updateStars() {
    starsContainer.querySelectorAll('.star').forEach((s, idx) => {
      if (idx < selectedRating) s.classList.add('active');
      else s.classList.remove('active');
    });
  }

  ratingGroup.append(starsContainer);

  const commentGroup = el('div', 'form-group');
  commentGroup.append(el('label', null, 'Comment / Feedback (Optional)'));
  const commentArea = el('textarea');
  commentArea.rows = 4;
  commentArea.placeholder = 'How was your guide, itinerary, and experience?';
  commentGroup.append(commentArea);

  const feedback = el('div', 'alert');
  feedback.style.display = 'none';

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn btn-secondary', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => modalContainer.replaceChildren());

  const submitBtn = el('button', 'btn btn-primary', 'Submit Review');
  submitBtn.type = 'submit';

  actions.append(cancelBtn, submitBtn);
  form.append(ratingGroup, commentGroup, feedback, actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    feedback.style.display = 'none';

    try {
      await apiFetch(`/bookings/${encodeURIComponent(booking.id)}/review`, {
        method: 'POST',
        body: {
          rating: selectedRating,
          comment: commentArea.value,
        },
      });
      modalContainer.replaceChildren();
      showAlert('Thank you for sharing your review!', 'alert-success');
      await loadBookings();
    } catch (err) {
      feedback.className = 'alert alert-error';
      feedback.textContent = err.message || 'Failed to submit review';
      feedback.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Review';
    }
  });

  dialog.append(form);
  backdrop.append(dialog);
  modalContainer.append(backdrop);
}

function showAlert(message, className) {
  const zone = document.getElementById('alert-zone');
  zone.replaceChildren();
  const alert = el('div', `alert ${className}`, message);
  zone.append(alert);
  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => zone.replaceChildren(), 500);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', initMyBookingsPage);
