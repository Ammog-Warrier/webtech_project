document.addEventListener('DOMContentLoaded', async () => {
  const publicHome = document.getElementById('public-home');
  const customerDashboard = document.getElementById('customer-dashboard');

  // Show the normal homepage if nobody is logged in
  if (!getToken()) return;

  try {
    const user = await fetchCurrentUser();

    // Show the dashboard only for customers
    if (!user || user.role !== 'CUSTOMER') return;

    document.getElementById('home-user-name').textContent =
      user.full_name || 'Traveller';

    document.getElementById('home-user-email').textContent =
      user.email || '';

    customerDashboard.hidden = false;

  } catch (err) {
    console.error('Could not load homepage dashboard:', err);
  }
});