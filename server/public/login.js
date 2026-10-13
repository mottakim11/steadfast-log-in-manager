document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('loginAlert');
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn ? loginBtn.querySelector('.btn-text') : null;
  const btnSpinner = loginBtn ? loginBtn.querySelector('.btn-spinner') : null;
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');

  const portalView = document.getElementById('extensionPortalView');
  const adminView = document.getElementById('adminSignInView');
  const stealthLogo = document.getElementById('stealthLogoTrigger');
  const holdRing = document.querySelector('.stealth-hold-ring');
  const holdCircle = document.getElementById('stealthHoldCircle');
  const closeAdminBtn = document.getElementById('closeAdminViewBtn');

  // Check if token already exists and verify
  const existingToken = localStorage.getItem('sflm_admin_token');
  if (existingToken) {
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${existingToken}` }
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = '/';
        return;
      }
    } catch (e) {
      // not valid, continue
    }
  }

  function showAlert(message, type = 'error') {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove('hidden');
  }

  // Password visibility toggle (Eye button)
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.style.color = isPassword ? '#006d5b' : '#94a3b8';
    });
  }

  // Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (alertBox) alertBox.classList.add('hidden');

      const username = document.getElementById('username').value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        showAlert('Please enter both username and password.');
        return;
      }

      if (loginBtn) loginBtn.disabled = true;
      if (btnText) btnText.textContent = 'Verifying...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          showAlert(data.error || 'Authentication failed. Please verify credentials.');
          if (loginBtn) loginBtn.disabled = false;
          if (btnText) btnText.textContent = 'Sign In';
          if (btnSpinner) btnSpinner.classList.add('hidden');
          return;
        }

        // Success
        localStorage.setItem('sflm_admin_token', data.token);
        localStorage.setItem('sflm_admin_user', data.username);
        if (data.isDefaultPassword) {
          sessionStorage.setItem('sflm_warn_default_pw', 'true');
        }

        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 500);

      } catch (err) {
        showAlert('Unable to reach server. Please check connection.');
        if (loginBtn) loginBtn.disabled = false;
        if (btnText) btnText.textContent = 'Sign In';
        if (btnSpinner) btnSpinner.classList.add('hidden');
      }
    });
  }

  // ==================== STEALTH SHIELD LOGO TRIGGER (2-3s HOLD) ====================
  // No visible text or hint exists on the page. Only clicking & holding the top-left logo reveals admin sign in.
  let holdTimer = null;
  let animInterval = null;
  const HOLD_DURATION = 2300; // 2.3 seconds
  const CIRCLE_CIRCUMFERENCE = 119.38; // 2 * pi * 19
  let startTime = 0;

  function revealAdminLogin() {
    if (!adminView || !portalView) return;
    portalView.classList.add('hidden');
    adminView.classList.remove('hidden');
    const userField = document.getElementById('username');
    if (userField) {
      setTimeout(() => userField.focus(), 150);
    }
  }

  function hideAdminLogin() {
    if (!adminView || !portalView) return;
    adminView.classList.add('hidden');
    portalView.classList.remove('hidden');
    if (alertBox) alertBox.classList.add('hidden');
  }

  if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', hideAdminLogin);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && adminView && !adminView.classList.contains('hidden')) {
      hideAdminLogin();
    }
  });

  if (stealthLogo && holdCircle && holdRing) {
    function startHold(e) {
      if (e.button && e.button !== 0) return; // Only left-click
      startTime = Date.now();
      holdRing.classList.add('active');

      animInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / HOLD_DURATION);
        const offset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * progress);
        holdCircle.style.strokeDashoffset = offset;
      }, 25);

      holdTimer = setTimeout(() => {
        clearInterval(animInterval);
        holdCircle.style.strokeDashoffset = 0;
        cancelHold();
        revealAdminLogin();
      }, HOLD_DURATION);
    }

    function cancelHold() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (animInterval) {
        clearInterval(animInterval);
        animInterval = null;
      }
      holdRing.classList.remove('active');
      holdCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
    }

    stealthLogo.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', cancelHold);
    stealthLogo.addEventListener('mouseleave', cancelHold);

    // Touch support for mobile devices
    stealthLogo.addEventListener('touchstart', (e) => {
      startHold(e);
    }, { passive: true });
    window.addEventListener('touchend', cancelHold);
    window.addEventListener('touchcancel', cancelHold);
  }

  // Extra Mock buttons handlers
  const forgotPwLink = document.getElementById('forgotPasswordLink');
  if (forgotPwLink) {
    forgotPwLink.addEventListener('click', (e) => {
      e.preventDefault();
      showAlert('To reset Master Password, run "node setup.js" in the server console.', 'info');
    });
  }

  const ssoGoogleBtn = document.getElementById('ssoGoogleBtn');
  if (ssoGoogleBtn) {
    ssoGoogleBtn.addEventListener('click', () => {
      showAlert('Enterprise SSO is configured for Steadfast internal domain.', 'info');
    });
  }

  const ssoMsBtn = document.getElementById('ssoMicrosoftBtn');
  if (ssoMsBtn) {
    ssoMsBtn.addEventListener('click', () => {
      showAlert('Microsoft Azure AD SSO is active on Steadfast domain.', 'info');
    });
  }

  const reqAccLink = document.getElementById('requestAccountLink');
  if (reqAccLink) {
    reqAccLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://wa.me/8801814163424', '_blank');
    });
  }
});
