document.addEventListener('DOMContentLoaded', () => {
  let isRedirecting = false;
  function redirectIfAuthenticated() {
    if (isRedirecting) return true;
    const existingToken = getToken();
    const existingUser = getStoredUser();
    if (existingToken && existingUser) {
      isRedirecting = true;
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get('redirect') || getRoleDashboardUrl(existingUser.role);
      window.location.replace(redirectUrl);
      return true;
    }
    return false;
  }

  // Handle back/forward navigation (bfcache)
  window.addEventListener('pageshow', () => {
    redirectIfAuthenticated();
  });

  if (redirectIfAuthenticated()) {
    return;
  }

  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('submit-btn');

  function showAlert(message, type = 'error') {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `auth-alert auth-alert-${type} show`;
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.textContent = '';
    alertBox.className = 'auth-alert';
  }

  // Pre-fill message if passed in query params (e.g. redirected from register or logout)
  const params = new URLSearchParams(window.location.search);
  if (params.get('notice')) {
    showAlert(params.get('notice'), 'info');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showAlert('Please enter both your email address and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setSession(data.token, data.user);

      isRedirecting = true;
      const target = params.get('redirect') || getRoleDashboardUrl(data.user.role);
      window.location.replace(target);
    } catch (err) {
      showAlert(err.message || 'Login failed. Please check your credentials.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
});
