document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const serverUrlInput = document.getElementById('serverUrl');
  const accessTokenInput = document.getElementById('accessToken');
  const alertBox = document.getElementById('statusAlert');
  const saveBtn = document.getElementById('saveBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const statusDot = document.getElementById('statusDot');
  const connectionText = document.getElementById('connectionText');

  // Load existing configuration
  chrome.storage.local.get(['serverUrl', 'accessToken'], async (data) => {
    if (data.serverUrl) serverUrlInput.value = data.serverUrl;
    if (data.accessToken) accessTokenInput.value = data.accessToken;

    if (data.serverUrl && data.accessToken) {
      await testConnection(data.serverUrl, data.accessToken, false);
    } else {
      updateStatus(false, 'Not configured. Please enter Server URL and Token.');
    }
  });

  function updateStatus(connected, text) {
    statusDot.className = 'dot ' + (connected ? 'connected' : 'disconnected');
    connectionText.textContent = text;
  }

  function showAlert(msg, isSuccess = true) {
    alertBox.textContent = msg;
    alertBox.className = `alert alert-${isSuccess ? 'success' : 'error'}`;
    alertBox.classList.remove('hidden');
  }

  async function testConnection(url, token, showSuccessAlert = true) {
    const cleanUrl = url.replace(/\/+$/, '');
    try {
      const res = await fetch(`${cleanUrl}/api/extension/ping`, {
        headers: { 'X-Extension-Token': token }
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        const officeLabel = data.officeName || data.tokenName || 'Valid';
        updateStatus(true, `Connected! Office: ${officeLabel}`);
        if (showSuccessAlert) {
          showAlert(`Connected successfully! Ready for Office: "${officeLabel}". Settings saved.`);
        }
        return true;
      } else {
        updateStatus(false, data.error || 'Server rejected token');
        showAlert(data.error || 'Invalid Token or Unauthorized', false);
        return false;
      }
    } catch (err) {
      updateStatus(false, 'Unable to connect to server');
      showAlert('Could not reach server at this URL. Please verify server address.', false);
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.add('hidden');

    const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
    const accessToken = accessTokenInput.value.trim();

    if (!serverUrl || !accessToken) {
      showAlert('Please fill in both fields.', false);
      return;
    }

    saveBtn.disabled = true;
    btnText.textContent = 'Testing Connection...';

    const isConnected = await testConnection(serverUrl, accessToken, true);

    // Save regardless so user doesn't lose input
    chrome.storage.local.set({ serverUrl, accessToken }, () => {
      saveBtn.disabled = false;
      btnText.textContent = 'Test Connection & Save';
    });
  });
});
