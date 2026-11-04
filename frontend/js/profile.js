async function initProfilePage() {
  const container = document.getElementById('profile-container');

  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('lt_token');
  if (!token) {
    window.location.replace(`/login.html?redirect=${encodeURIComponent(location.pathname)}`);
    return;
  }

  try {
    const profile = await apiFetch('/users/profile');
    renderProfileForm(container, profile);
  } catch (err) {
    showMessage(container, `Failed to load profile: ${err.message}`);
  }
}

function renderProfileForm(container, profile) {
  container.replaceChildren();

  const card = el('div', 'form-card');
  const header = el('div');
  header.append(
    el('h2', null, 'My Profile & Address'),
    el('p', 'muted', 'View and update your personal details and primary contact address.')
  );
  header.style.marginBottom = '1.5rem';

  const form = el('form');

  // Basic info
  const nameGroup = el('div', 'form-group');
  nameGroup.append(el('label', null, 'Full Name'));
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.value = profile.full_name || '';
  nameInput.required = true;
  nameGroup.append(nameInput);

  const emailGroup = el('div', 'form-group');
  emailGroup.append(el('label', null, 'Email Address (Read-Only)'));
  const emailInput = el('input');
  emailInput.type = 'email';
  emailInput.value = profile.email || '';
  emailInput.readOnly = true;
  emailInput.style.opacity = '0.75';
  emailGroup.append(emailInput);

  const phoneGroup = el('div', 'form-group');
  phoneGroup.append(el('label', null, 'Phone Number'));
  const phoneInput = el('input');
  phoneInput.type = 'tel';
  phoneInput.value = profile.phone || '';
  phoneInput.placeholder = '+91 9876543210';
  phoneGroup.append(phoneInput);

  // Address Section
  const addrHeader = el('h3', null, 'Contact Address');
  addrHeader.style.marginTop = '1.75rem';
  addrHeader.style.marginBottom = '1rem';
  addrHeader.style.fontSize = '1.1rem';

  const addr = profile.address || {};

  const streetGroup = el('div', 'form-group');
  streetGroup.append(el('label', null, 'Street Address'));
  const streetInput = el('input');
  streetInput.type = 'text';
  streetInput.value = addr.street || '';
  streetInput.placeholder = '123 Main St, Apartment 4B';
  streetGroup.append(streetInput);

  const cityRow = el('div');
  cityRow.style.display = 'grid';
  cityRow.style.gridTemplateColumns = '1fr 1fr';
  cityRow.style.gap = '1rem';

  const cityGroup = el('div', 'form-group');
  cityGroup.append(el('label', null, 'City'));
  const cityInput = el('input');
  cityInput.type = 'text';
  cityInput.value = addr.city || '';
  cityInput.placeholder = 'Bengaluru';
  cityGroup.append(cityInput);

  const stateGroup = el('div', 'form-group');
  stateGroup.append(el('label', null, 'State / Region'));
  const stateInput = el('input');
  stateInput.type = 'text';
  stateInput.value = addr.state || '';
  stateInput.placeholder = 'Karnataka';
  stateGroup.append(stateInput);

  cityRow.append(cityGroup, stateGroup);

  const postalRow = el('div');
  postalRow.style.display = 'grid';
  postalRow.style.gridTemplateColumns = '1fr 1fr';
  postalRow.style.gap = '1rem';

  const postalGroup = el('div', 'form-group');
  postalGroup.append(el('label', null, 'Postal Code / PIN'));
  const postalInput = el('input');
  postalInput.type = 'text';
  postalInput.value = addr.postal_code || '';
  postalInput.placeholder = '560001';
  postalGroup.append(postalInput);

  const countryGroup = el('div', 'form-group');
  countryGroup.append(el('label', null, 'Country'));
  const countryInput = el('input');
  countryInput.type = 'text';
  countryInput.value = addr.country || 'India';
  countryGroup.append(countryInput);

  postalRow.append(postalGroup, countryGroup);

  const feedback = el('div', 'alert');
  feedback.style.display = 'none';

  const submitBtn = el('button', 'btn btn-primary', 'Save Changes');
  submitBtn.type = 'submit';
  submitBtn.style.marginTop = '1.5rem';
  submitBtn.style.width = '100%';

  form.append(
    nameGroup,
    emailGroup,
    phoneGroup,
    addrHeader,
    streetGroup,
    cityRow,
    postalRow,
    feedback,
    submitBtn
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    feedback.style.display = 'none';

    const payload = {
      full_name: nameInput.value.trim(),
      phone: phoneInput.value.trim() || null,
    };

    if (streetInput.value.trim() || cityInput.value.trim() || postalInput.value.trim()) {
      payload.address = {
        street: streetInput.value.trim(),
        city: cityInput.value.trim(),
        state: stateInput.value.trim() || null,
        postal_code: postalInput.value.trim(),
        country: countryInput.value.trim() || 'India',
      };
    }

    try {
      const updated = await apiFetch('/users/profile', {
        method: 'PUT',
        body: payload,
      });

      // Update cached user storage
      const stored = typeof getStoredUser === 'function' ? getStoredUser() : null;
      if (stored) {
        stored.full_name = updated.full_name;
        stored.phone = updated.phone;
        localStorage.setItem('lt_user', JSON.stringify(stored));
        if (typeof syncNavbarAuth === 'function') syncNavbarAuth();
      }

      feedback.className = 'alert alert-success';
      feedback.textContent = 'Profile and address updated successfully!';
      feedback.style.display = 'block';
    } catch (err) {
      feedback.className = 'alert alert-error';
      feedback.textContent = err.message || 'Failed to update profile';
      feedback.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });

  card.append(header, form);
  container.append(card);
}

document.addEventListener('DOMContentLoaded', initProfilePage);
