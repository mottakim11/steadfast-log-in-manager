document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const officeTitleDisplay = document.getElementById('officeTitleDisplay');
  const popupStatusLine = document.getElementById('popupStatusLine');
  const toggleConfigBtn = document.getElementById('toggleConfigBtn');
  const setupFormSection = document.getElementById('setupFormSection');
  const accountsSection = document.getElementById('accountsSection');
  const popupServerUrl = document.getElementById('popupServerUrl');
  const popupSecretKey = document.getElementById('popupSecretKey');
  const saveSetupBtn = document.getElementById('saveSetupBtn');
  const setupAlert = document.getElementById('setupAlert');
  const openPortalBtn = document.getElementById('openPortalBtn');
  const accountsContainer = document.getElementById('accountsContainer');

  const STEADFAST_LOGIN_URL = 'https://steadfast.com.bd/moderator/login';

  let currentServerUrl = '';
  let currentSecretKey = '';

  if (openPortalBtn) {
    openPortalBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: STEADFAST_LOGIN_URL });
    });
  }

  toggleConfigBtn.addEventListener('click', () => {
    const isShowingSetup = !setupFormSection.classList.contains('hidden');
    if (isShowingSetup) {
      setupFormSection.classList.add('hidden');
      accountsSection.classList.remove('hidden');
    } else {
      setupFormSection.classList.remove('hidden');
      accountsSection.classList.add('hidden');
      popupServerUrl.value = currentServerUrl || 'http://localhost:3000';
      popupSecretKey.value = currentSecretKey || '';
      setupAlert.classList.add('hidden');
    }
  });

  function showAlert(msg, isSuccess = false) {
    setupAlert.textContent = msg;
    setupAlert.className = `alert-msg ${isSuccess ? 'success' : 'error'}`;
    setupAlert.classList.remove('hidden');
  }

  saveSetupBtn.addEventListener('click', async () => {
    const url = popupServerUrl.value.trim().replace(/\/+$/, '');
    const key = popupSecretKey.value.trim();

    if (!url || !key) {
      showAlert('Please enter both Server URL and Office Secret Key.');
      return;
    }

    saveSetupBtn.disabled = true;
    saveSetupBtn.textContent = 'Testing...';
    setupAlert.classList.add('hidden');

    try {
      const res = await fetch(`${url}/api/extension/ping`, {
        headers: { 'X-Extension-Token': key }
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Invalid Office Secret Key.');
      }

      currentServerUrl = url;
      currentSecretKey = key;

      chrome.storage.local.set({ serverUrl: url, accessToken: key }, () => {
        saveSetupBtn.disabled = false;
        saveSetupBtn.textContent = 'Connect & Save';
        showAlert(`Connected to: ${data.officeName || data.tokenName || 'Office'}!`, true);

        setTimeout(() => {
          setupFormSection.classList.add('hidden');
          accountsSection.classList.remove('hidden');
          loadAccounts(url, key);
        }, 800);
      });
    } catch (err) {
      saveSetupBtn.disabled = false;
      saveSetupBtn.textContent = 'Connect & Save';
      showAlert(err.message || 'Connection failed.');
    }
  });

  async function loadAccounts(url, key) {
    if (statusDot) statusDot.className = 'dot';
    if (popupStatusLine) popupStatusLine.textContent = 'Connecting...';
    accountsContainer.innerHTML = '<div class="loading-state">Loading accounts...</div>';

    try {
      const res = await fetch(`${url}/api/extension/accounts`, {
        headers: { 'X-Extension-Token': key }
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        if (statusDot) statusDot.className = 'dot disconnected';
        if (popupStatusLine) popupStatusLine.textContent = 'Invalid key';
        accountsContainer.innerHTML = `<div class="empty-state">${json.error || 'Authorization failed'}</div>`;
        return;
      }

      if (statusDot) statusDot.className = 'dot connected';
      const officeName = (json.offices && json.offices[0]) ? json.offices[0].name : 'Office Accounts';
      if (officeTitleDisplay) officeTitleDisplay.textContent = officeName;
      if (popupStatusLine) popupStatusLine.textContent = 'Ready';
      renderAccounts(json.offices || []);
    } catch (err) {
      if (statusDot) statusDot.className = 'dot disconnected';
      if (popupStatusLine) popupStatusLine.textContent = 'Server offline';
      accountsContainer.innerHTML = '<div class="empty-state">Could not connect to Admin Server.</div>';
    }
  }

  function renderAccounts(offices) {
    const allAccounts = offices.flatMap(off => off.accounts || []);
    if (!allAccounts.length) {
      accountsContainer.innerHTML = '<div class="empty-state">No accounts found for this office.</div>';
      return;
    }

    accountsContainer.innerHTML = allAccounts.map(acc => `
      <button class="account-btn" data-id="${acc.id}" title="Click to auto login as ${escapeHtml(acc.displayName)}">
        ${escapeHtml(acc.displayName)}
      </button>
    `).join('');

    accountsContainer.querySelectorAll('.account-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const accountId = btn.getAttribute('data-id');
        loginAccount(accountId);
      });
    });
  }

  async function loginAccount(accountId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('steadfast.com.bd/moderator/login')) {
      chrome.tabs.sendMessage(tab.id, { action: 'DO_AUTO_LOGIN', accountId }, () => {
        window.close();
      });
    } else {
      chrome.tabs.create({ url: STEADFAST_LOGIN_URL });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m]);
  }

  // Initial check
  chrome.storage.local.get(['serverUrl', 'accessToken'], (data) => {
    currentServerUrl = data.serverUrl || '';
    currentSecretKey = data.accessToken || '';

    if (!currentServerUrl || !currentSecretKey) {
      if (statusDot) statusDot.className = 'dot disconnected';
      if (popupStatusLine) popupStatusLine.textContent = 'Setup needed';
      setupFormSection.classList.remove('hidden');
      accountsSection.classList.add('hidden');
      popupServerUrl.value = currentServerUrl || 'http://localhost:3000';
    } else {
      setupFormSection.classList.add('hidden');
      accountsSection.classList.remove('hidden');
      loadAccounts(currentServerUrl, currentSecretKey);
    }
  });
});
