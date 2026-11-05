let providerDeparturePackages = [];
let editingDepartureId = null;

function departureAlert(message, type = 'error') {
  const box = document.getElementById('provider-departures-alert');
  box.textContent = message;
  box.className = `auth-alert auth-alert-${type} show`;
}

function clearDepartureAlert() {
  const box = document.getElementById('provider-departures-alert');
  box.textContent = '';
  box.className = 'auth-alert';
}

function resetDepartureForm() {
  editingDepartureId = null;
  const form = document.getElementById('provider-departure-form');
  form.reset();
  form.elements.seats_total.value = 12;
  document.getElementById('departure-editor-title').textContent = 'Add departure';
  document.getElementById('save-departure-btn').textContent = 'Add departure';
  document.getElementById('cancel-departure-edit').hidden = true;
}

function renderDepartures(departures) {
  const list = document.getElementById('provider-departure-list');
  list.replaceChildren();
  if (!departures.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No departures scheduled yet.';
    list.appendChild(empty);
    return;
  }
  departures.forEach((departure) => {
    const card = document.createElement('article');
    card.className = 'provider-package-card';
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = departure.package_title;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `Departure: ${departure.start_date} · Seats: ${departure.booked_seats}/${departure.seats_total} booked · ${departure.seats_available} available`;
    details.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'provider-package-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      editingDepartureId = departure.id;
      const form = document.getElementById('provider-departure-form');
      form.elements.package_id.value = departure.package_id;
      form.elements.start_date.value = departure.start_date;
      form.elements.seats_total.value = departure.seats_total;
      document.getElementById('departure-editor-title').textContent = 'Edit departure';
      document.getElementById('save-departure-btn').textContent = 'Save changes';
      document.getElementById('cancel-departure-edit').hidden = false;
      document.getElementById('departure-editor').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this departure? Departures with booking history cannot be deleted.')) return;
      try {
        await apiFetch(`/provider/departures/${departure.id}`, { method: 'DELETE' });
        departureAlert('Departure deleted.', 'success');
        await loadDepartures();
      } catch (err) {
        departureAlert(err.message);
      }
    });
    actions.append(edit, remove);
    card.append(details, actions);
    list.appendChild(card);
  });
}

async function loadDepartures() {
  const departures = await apiFetch('/provider/departures');
  renderDepartures(departures);
}

async function initProviderDepartures() {
  if (!getToken()) {
    window.location.replace('/login.html?redirect=%2Fprovider-departures.html');
    return;
  }
  try {
    const user = await fetchCurrentUser();
    if (!user) return;
    if (user.role !== 'PROVIDER') {
      window.location.replace(getRoleDashboardUrl(user.role));
      return;
    }
    if (user.provider_status !== 'APPROVED') {
      departureAlert(`Provider approval required. Current status: ${user.provider_status}.`);
      document.getElementById('provider-departure-form').querySelectorAll('input,select,button').forEach((el) => { el.disabled = true; });
      return;
    }
    providerDeparturePackages = await apiFetch('/provider/departure-packages');
    const select = document.getElementById('departure-package');
    providerDeparturePackages.forEach((pkg) => {
      const option = document.createElement('option');
      option.value = pkg.id;
      option.textContent = pkg.title;
      select.appendChild(option);
    });
    const requestedPackage = new URLSearchParams(window.location.search).get('package_id');
    if (requestedPackage && providerDeparturePackages.some((pkg) => String(pkg.id) === requestedPackage)) {
      select.value = requestedPackage;
    }
    if (!providerDeparturePackages.length) {
      departureAlert('You need at least one APPROVED package before scheduling departures.');
      document.getElementById('save-departure-btn').disabled = true;
    }
    await loadDepartures();
  } catch (err) {
    departureAlert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cancel-departure-edit').addEventListener('click', resetDepartureForm);
  document.getElementById('provider-departure-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearDepartureAlert();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    body.package_id = Number(body.package_id);
    body.seats_total = Number(body.seats_total);
    const button = document.getElementById('save-departure-btn');
    button.disabled = true;
    try {
      await apiFetch(editingDepartureId ? `/provider/departures/${editingDepartureId}` : '/provider/departures', {
        method: editingDepartureId ? 'PUT' : 'POST',
        body: editingDepartureId
          ? { start_date: body.start_date, seats_total: body.seats_total }
          : body,
      });
      departureAlert(editingDepartureId ? 'Departure updated.' : 'Departure created.', 'success');
      resetDepartureForm();
      await loadDepartures();
    } catch (err) {
      departureAlert(err.message);
    } finally {
      button.disabled = false;
    }
  });
  initProviderDepartures();
});
