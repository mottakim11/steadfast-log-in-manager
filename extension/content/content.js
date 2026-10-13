(() => {
  // Prevent duplicate injection
  if (document.getElementById('sslm-widget-container')) {
    return;
  }

  let serverUrl = '';
  let accessToken = '';
  let isOpen = false; // Popup open state (initially hidden behind shield icon)

  // Create UI Container
  const container = document.createElement('div');
  container.id = 'sslm-widget-container';
  document.documentElement.appendChild(container);

  // Restore saved position
  restorePosition(container);

  function hardenForm() {
    for (const form of document.querySelectorAll('form')) {
      form.setAttribute('autocomplete', 'off');
    }
    const emailInput = findEmailInput();
    const passwordInput = findPasswordInput();
    if (emailInput) {
      emailInput.setAttribute('autocomplete', 'off');
      emailInput.setAttribute('data-lpignore', 'true');
      emailInput.setAttribute('data-1p-ignore', 'true');
    }
    if (passwordInput) {
      passwordInput.setAttribute('autocomplete', 'off');
      passwordInput.setAttribute('data-lpignore', 'true');
      passwordInput.setAttribute('data-1p-ignore', 'true');
    }
  }

  function findEmailInput() {
    return (
      document.querySelector('input[type="email"]') ||
      document.querySelector('input[name*="email" i]') ||
      document.querySelector('input[id*="email" i]') ||
      document.querySelector('input[name*="user" i]') ||
      document.querySelector('input[id*="user" i]') ||
      document.querySelector('input[name*="login" i]') ||
      document.querySelector('input[type="text"]')
    );
  }

  function findPasswordInput() {
    return document.querySelector('input[type="password"]');
  }

  function setInputValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // High-security auto-login submission without leaking password in DOM or triggering Chrome's password manager
  async function fillAndSubmit(credentials) {
    const emailInput = findEmailInput();
    const passwordInput = findPasswordInput();
    const form = emailInput?.form || passwordInput?.form || document.querySelector('form');

    if (!emailInput || !passwordInput || !form) {
      throw new Error('Steadfast login form input fields not found on this page.');
    }

    hardenForm();

    // Fill visible email input
    setInputValue(emailInput, credentials.email);

    // Collect CSRF and form values
    const csrfInput = form.querySelector('input[name="_token"]') || document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfInput ? (csrfInput.value || csrfInput.getAttribute('content')) : '';

    const params = new URLSearchParams();
    if (csrfToken) {
      params.append('_token', csrfToken);
    }
    params.append(emailInput.name || 'email', credentials.email);
    params.append(passwordInput.name || 'password', credentials.password);
    params.append('remember', '1');

    // ANTI-HACK / SECURITY: Blank and de-type the password field in the DOM so
    // Chrome's Password Manager DOES NOT intercept it and DOES NOT show the "Save password?" prompt!
    passwordInput.value = '';
    passwordInput.type = 'text';

    // Submit via direct fetch with same-origin credentials
    const actionUrl = form.action || window.location.href;
    const response = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      credentials: 'include',
      redirect: 'follow'
    });

    if (response.redirected) {
      window.location.href = response.url;
      return;
    }

    const responseText = await response.text();
    if (response.ok && response.url && !response.url.includes('/login')) {
      window.location.href = response.url;
    } else if (responseText.includes('These credentials do not match') || responseText.includes('invalid')) {
      passwordInput.type = 'password';
      throw new Error('These credentials do not match Steadfast records.');
    } else {
      window.location.href = 'https://steadfast.com.bd/moderator';
    }
  }

  async function api(path, options = {}) {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': accessToken,
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  // Drag & Move functionality
  function makeDraggable(container, handle) {
    let isDragging = false;
    let didMove = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onMouseDown(e) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      didMove = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      container.style.bottom = 'auto';
      container.style.right = 'auto';
      container.style.left = `${initialLeft}px`;
      container.style.top = `${initialTop}px`;
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMove = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = Math.max(0, window.innerWidth - (container.offsetWidth || 60));
      const maxTop = Math.max(0, window.innerHeight - (container.offsetHeight || 60));

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;

      const rect = container.getBoundingClientRect();
      chrome.storage.local.set({
        sslmWidgetPosition: {
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        }
      });
    }

    handle.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch support
    handle.addEventListener('touchstart', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const t = e.touches[0];
      isDragging = true;
      startX = t.clientX;
      startY = t.clientY;
      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      container.style.bottom = 'auto';
      container.style.right = 'auto';
      container.style.left = `${initialLeft}px`;
      container.style.top = `${initialTop}px`;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      let newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - (container.offsetWidth || 60)));
      let newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - (container.offsetHeight || 60)));
      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const rect = container.getBoundingClientRect();
      chrome.storage.local.set({
        sslmWidgetPosition: {
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        }
      });
    });
  }

  function restorePosition(container) {
    chrome.storage.local.get(['sslmWidgetPosition'], (data) => {
      if (data.sslmWidgetPosition) {
        const { top, left } = data.sslmWidgetPosition;
        const maxLeft = Math.max(0, window.innerWidth - 60);
        const maxTop = Math.max(0, window.innerHeight - 60);
        const safeLeft = Math.max(0, Math.min(left, maxLeft));
        const safeTop = Math.max(0, Math.min(top, maxTop));
        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.top = `${safeTop}px`;
        container.style.left = `${safeLeft}px`;
      }
    });
  }

  // ---------------- Shield Trigger with 2-3 Second Hold to Open (Image 2) ---------------- //
  function renderShieldTrigger() {
    container.innerHTML = `
      <div class="sslm-shield-box" title="Hold for 2-3 seconds to open Steadfast Login Manager">
        <svg class="sslm-progress-ring">
          <circle class="sslm-progress-ring-circle" cx="30" cy="30" r="28"></circle>
        </svg>
        <div class="sslm-shield-btn">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <div class="sslm-hold-tooltip">Hold 2-3s to open</div>
      </div>
    `;

    const shieldBox = container.querySelector('.sslm-shield-box');
    const ringCircle = container.querySelector('.sslm-progress-ring-circle');
    const tooltip = container.querySelector('.sslm-hold-tooltip');

    makeDraggable(container, shieldBox);

    let holdTimer = null;
    let animInterval = null;
    const HOLD_DURATION = 2300; // 2.3 seconds
    let startTime = 0;

    function startHold(e) {
      // Ignore right clicks
      if (e.button && e.button !== 0) return;

      startTime = Date.now();
      tooltip.textContent = 'Keep holding...';
      tooltip.style.opacity = '1';

      // Animate progress circle
      animInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / HOLD_DURATION);
        const offset = 176 - (176 * progress);
        ringCircle.style.strokeDashoffset = offset;
      }, 30);

      holdTimer = setTimeout(() => {
        clearInterval(animInterval);
        ringCircle.style.strokeDashoffset = 0;
        isOpen = true;
        init(); // Open popup
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
      ringCircle.style.strokeDashoffset = 176;
      tooltip.textContent = 'Hold 2-3s to open';
      tooltip.style.opacity = '';
    }

    shieldBox.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', cancelHold);
    shieldBox.addEventListener('mouseleave', cancelHold);

    // Touch support for holding
    shieldBox.addEventListener('touchstart', (e) => {
      startHold(e);
    }, { passive: true });
    window.addEventListener('touchend', cancelHold);
    window.addEventListener('touchcancel', cancelHold);
  }

  // ---------------- Config Setup View ---------------- //
  function renderConfigView(errMsg = '') {
    container.innerHTML = `
      <div class="sslm-popup-card">
        <div class="sslm-popup-header">
          <span class="sslm-popup-title">Steadfast Login Manager</span>
          <button class="sslm-icon-btn sslm-close-btn" title="Close">&times;</button>
        </div>
        <div class="sslm-config-body">
          <div class="sslm-config-title">Extension Setup</div>
          ${errMsg ? `<div class="sslm-alert error">${escapeHtml(errMsg)}</div>` : ''}
          <div class="sslm-field">
            <label>Admin Server URL</label>
            <input type="url" id="sslmInputServer" class="sslm-input" placeholder="http://localhost:3000" value="${escapeHtml(serverUrl || 'http://localhost:3000')}">
          </div>
          <div class="sslm-field">
            <label>Office Secret Key</label>
            <input type="password" id="sslmInputKey" class="sslm-input" placeholder="sflm_off_..." value="${escapeHtml(accessToken)}">
          </div>
          <button type="button" id="sslmBtnSaveConfig" class="sslm-save-btn">Connect & Save</button>
        </div>
        <div class="sslm-popup-footer">
          <a href="https://wa.me/8801814163424" target="_blank" rel="noopener">Developed by Mottakim (01814163424)</a>
        </div>
      </div>
    `;

    const header = container.querySelector('.sslm-popup-header');
    makeDraggable(container, header);

    container.querySelector('.sslm-close-btn').addEventListener('click', () => {
      isOpen = false;
      renderShieldTrigger();
    });

    const saveBtn = container.querySelector('#sslmBtnSaveConfig');
    saveBtn.addEventListener('click', async () => {
      const urlVal = container.querySelector('#sslmInputServer').value.trim().replace(/\/+$/, '');
      const keyVal = container.querySelector('#sslmInputKey').value.trim();

      if (!urlVal || !keyVal) {
        alert('Please enter both Admin Server URL and Office Secret Key.');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Testing connection...';

      try {
        const pingRes = await fetch(`${urlVal}/api/extension/ping`, {
          headers: { 'X-Extension-Token': keyVal }
        });
        const pingData = await pingRes.json().catch(() => ({}));

        if (!pingRes.ok || !pingData.ok) {
          throw new Error(pingData.error || 'Invalid Office Secret Key.');
        }

        serverUrl = urlVal;
        accessToken = keyVal;
        chrome.storage.local.set({ serverUrl: urlVal, accessToken: keyVal }, () => {
          isOpen = true;
          init();
        });
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Connect & Save';
        renderConfigView(err.message || 'Connection failed.');
      }
    });
  }

  // ---------------- Accounts Popup Card (Image 3 Design) ---------------- //
  function renderAccountsPopup(offices) {
    const office = (offices && offices[0]) ? offices[0] : null;
    const officeName = office ? office.name : 'Office Accounts';
    const accounts = office ? office.accounts : [];

    let buttonsHtml = '';
    if (!accounts.length) {
      buttonsHtml = '<div class="sslm-notice">No accounts found for this office. Please add accounts in Admin Panel.</div>';
    } else {
      buttonsHtml = accounts.map(acc => `
        <button class="sslm-account-btn" data-id="${acc.id}">
          ${escapeHtml(acc.displayName)}
        </button>
      `).join('');
    }

    container.innerHTML = `
      <div class="sslm-popup-card">
        <div class="sslm-popup-header">
          <span class="sslm-popup-title">Steadfast Login Manager</span>
          <div class="sslm-header-actions">
            <button class="sslm-icon-btn sslm-config-btn" title="Settings / Change Key">⚙</button>
            <button class="sslm-icon-btn sslm-close-btn" title="Hide">&times;</button>
          </div>
        </div>

        <div class="sslm-popup-body">
          <div class="sslm-office-name">${escapeHtml(officeName)}</div>
          <div class="sslm-btn-list">
            ${buttonsHtml}
          </div>
          <div class="sslm-status-text" id="sslmStatusText">Ready</div>
        </div>

        <div class="sslm-popup-footer">
          <a href="https://wa.me/8801814163424" target="_blank" rel="noopener">
            Developed by Mottakim
          </a>
        </div>
      </div>
    `;

    const header = container.querySelector('.sslm-popup-header');
    makeDraggable(container, header);

    // Close button hides back to shield icon
    container.querySelector('.sslm-close-btn').addEventListener('click', () => {
      isOpen = false;
      renderShieldTrigger();
    });

    // Settings button
    container.querySelector('.sslm-config-btn').addEventListener('click', () => {
      renderConfigView();
    });

    // Button click handlers
    container.querySelectorAll('.sslm-account-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        executeLogin(btn.dataset.id, btn);
      });
    });
  }

  async function executeLogin(accountId, triggerBtn = null) {
    const statusText = container.querySelector('#sslmStatusText');
    if (statusText) statusText.textContent = 'Fetching real-time credentials...';
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Logging in...';
    }

    try {
      const payload = await api('/api/extension/login-fill', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId })
      });

      if (!payload.credentials) {
        throw new Error('Credentials missing from server.');
      }

      if (statusText) statusText.textContent = 'Submitting credentials...';
      await fillAndSubmit(payload.credentials);

      if (statusText) statusText.textContent = 'Logged in successfully!';
    } catch (err) {
      if (statusText) statusText.textContent = 'Error: ' + err.message;
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'Retry';
      }
      alert('Steadfast Auto Login: ' + err.message);
    }
  }

  async function init() {
    chrome.storage.local.get(['serverUrl', 'accessToken'], async (data) => {
      serverUrl = data.serverUrl || '';
      accessToken = data.accessToken || '';

      // If not open yet, show the floating shield trigger (Image 2)
      if (!isOpen) {
        renderShieldTrigger();
        return;
      }

      // If open but not configured, show config view
      if (!serverUrl || !accessToken) {
        renderConfigView();
        return;
      }

      // Fetch accounts and render popup (Image 3)
      try {
        const payload = await api('/api/extension/accounts');
        renderAccountsPopup(payload.offices || []);
      } catch (err) {
        renderConfigView(`Error: ${err.message}. Please verify Server URL & Secret Key.`);
      }
    });
  }

  // Listen for message from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'DO_AUTO_LOGIN' && req.accountId) {
      isOpen = true;
      executeLogin(req.accountId);
      sendResponse({ ok: true });
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m]);
  }

  hardenForm();
  init();
})();
