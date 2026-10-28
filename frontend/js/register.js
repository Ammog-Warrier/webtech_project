document.addEventListener('DOMContentLoaded', () => {
  let isRedirecting = false;
  function redirectIfAuthenticated() {
    if (isRedirecting) return true;
    const existingToken = getToken();
    const existingUser = getStoredUser();
    if (existingToken && existingUser) {
      isRedirecting = true;
      window.location.replace(getRoleDashboardUrl(existingUser.role));
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

  const form = document.getElementById('register-form');
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const fullName = form.full_name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const phone = form.phone.value.trim();
    const role = form.role.value;
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;

    // Client-side validations adhering to backend constraints
    if (!fullName || fullName.length > 100) {
      showAlert('Full name is required (maximum 100 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 150) {
      showAlert('Please enter a valid email address.');
      return;
    }

    if (phone && !/^[0-9+()\- ]{6,20}$/.test(phone)) {
      showAlert('Phone number must be valid (6–20 characters with digits, +, -, spaces).');
      return;
    }

    if (!password || password.length < 8 || password.length > 72) {
      showAlert('Password must be between 8 and 72 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Passwords do not match.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      // 1. Register user
      const registerPayload = {
        full_name: fullName,
        email,
        phone: phone || undefined,
        role,
        password,
      };

      await apiFetch('/auth/register', {
        method: 'POST',
        body: registerPayload,
      });

      // 2. Perform seamless automatic login
      submitBtn.textContent = 'Finalizing account…';
      const loginData = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setSession(loginData.token, loginData.user);

      // 3. User feedback and redirection
      submitBtn.textContent = 'Redirecting…';
      if (role === 'PROVIDER') {
        showAlert('Account created! Your provider status is pending admin approval. Redirecting…', 'info');
      } else {
        showAlert('Account created successfully! Redirecting…', 'success');
      }

      setTimeout(() => {
        isRedirecting = true;
        const target = getRoleDashboardUrl(loginData.user.role);
        window.location.replace(target);
      }, 700);
    } catch (err) {
      showAlert(err.message || 'Registration failed. Please check the form and try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
});
