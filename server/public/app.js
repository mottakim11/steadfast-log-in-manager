document.addEventListener('DOMContentLoaded', () => {
  // Authentication check
  const token = localStorage.getItem('sflm_admin_token');
  const username = localStorage.getItem('sflm_admin_user') || 'Admin';

  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Set username in header
  document.getElementById('adminUsernameBadge').textContent = username;

  // Check if warned about default password
  if (sessionStorage.getItem('sflm_warn_default_pw') === 'true') {
    document.getElementById('defaultPwBanner').classList.remove('hidden');
  }

  // Theme management (Light Mode default)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    }
    localStorage.setItem('sflm_theme', theme);
  }

  const currentTheme = localStorage.getItem('sflm_theme') || 'light';
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(active === 'dark' ? 'light' : 'dark');
    });
  }

  // Global State
  let offices = [];
  let accounts = [];
  let tokens = [];
  let settings = {};

  // Toast notification helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Authenticated API Fetch wrapper
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    };

    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('sflm_admin_token');
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  }

  // ---------------- Navigation Tabs ---------------- //
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(target).classList.add('active');

      if (target === 'tab-accounts') loadAccounts();
      if (target === 'tab-offices') loadOffices();
      if (target === 'tab-tokens') loadTokens();
      if (target === 'tab-logs') loadLogs();
      if (target === 'tab-settings') loadSettings();
    });
  });

  // ---------------- Stats ---------------- //
  async function loadStats() {
    try {
      const data = await api('/api/admin/stats');
      document.getElementById('statOffices').textContent = data.stats.totalOffices;
      document.getElementById('statAccounts').textContent = data.stats.totalAccounts;
      document.getElementById('statTokens').textContent = data.stats.activeTokens;
      document.getElementById('statTodayLogins').textContent = data.stats.todayLogins;
    } catch (err) {
      console.error('Stats error:', err);
    }
  }

  // ---------------- Offices ---------------- //
  async function loadOffices() {
    try {
      const data = await api('/api/admin/offices');
      offices = data.offices || [];
      renderOffices();
      populateOfficeDropdowns();
    } catch (err) {
      showToast('Failed to load offices: ' + err.message, 'error');
    }
  }

  function renderOffices() {
    const tbody = document.getElementById('officesTableBody');
    if (!offices.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No offices created yet. Click "Add Office" above.</td></tr>`;
      return;
    }

    tbody.innerHTML = offices.map(o => {
      const accCount = accounts.filter(a => a.office_id === o.id).length;
      const keyVal = o.secret_key || '';
      return `
        <tr>
          <td><strong>${escapeHtml(o.name)}</strong></td>
          <td><span class="badge badge-blue">${escapeHtml(o.code || 'N/A')}</span></td>
          <td>
            <div class="d-flex align-center gap-2">
              <code style="font-size: 0.8rem; background: var(--bg-hover, rgba(0,0,0,0.05)); padding: 2px 6px; border-radius: 4px;" title="${escapeHtml(keyVal)}">${escapeHtml(keyVal ? keyVal.substring(0, 15) + '...' : 'Generating...')}</code>
              <button class="btn-action copy-office-key-btn" data-key="${escapeHtml(keyVal)}" data-name="${escapeHtml(o.name)}" title="Copy Office Secret Key">
                📋 Copy Key
              </button>
              <button class="btn-action regen-office-key-btn" data-id="${o.id}" data-name="${escapeHtml(o.name)}" title="Regenerate Office Secret Key">
                🔄
              </button>
            </div>
          </td>
          <td>${accCount} accounts</td>
          <td><span class="badge badge-${o.status === 'active' ? 'active' : 'inactive'}">${o.status}</span></td>
          <td class="text-muted" style="font-size: 0.8rem;">${new Date(o.created_at).toLocaleDateString()}</td>
          <td class="text-right">
            <div class="table-actions">
              <button class="btn-action edit-office-btn" data-id="${o.id}">Edit</button>
              <button class="btn-action btn-action-danger delete-office-btn" data-id="${o.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.copy-office-key-btn').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        const name = b.dataset.name;
        if (key) {
          navigator.clipboard.writeText(key);
          showToast(`Secret Key for "${name}" copied to clipboard!`);
        }
      });
    });

    tbody.querySelectorAll('.regen-office-key-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const name = b.dataset.name;
        if (!confirm(`Regenerate Secret Key for "${name}"?\nAny Chrome extensions configured with the old key will need to be updated with the new key.`)) return;
        try {
          await api(`/api/admin/offices/${id}/regenerate-key`, { method: 'POST' });
          showToast(`New Secret Key generated for "${name}"!`);
          await loadOffices();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    tbody.querySelectorAll('.edit-office-btn').forEach(b => {
      b.addEventListener('click', () => editOffice(b.dataset.id));
    });
    tbody.querySelectorAll('.delete-office-btn').forEach(b => {
      b.addEventListener('click', () => deleteOffice(b.dataset.id));
    });
  }

  function populateOfficeDropdowns() {
    // Filter in accounts tab
    const filterSelect = document.getElementById('accountOfficeFilter');
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="">All Offices</option>` +
      offices.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
    filterSelect.value = currentVal;

    // Modal office select for accounts
    const modalSelect = document.getElementById('accountOfficeId');
    modalSelect.innerHTML = `<option value="">Select Office...</option>` +
      offices.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');

    // Modal office scope for tokens
    const tokenScopeSelect = document.getElementById('tokenOfficeScope');
    tokenScopeSelect.innerHTML = `<option value="all">All Offices (Show all branch accounts)</option>` +
      offices.map(o => `<option value="${o.id}">${escapeHtml(o.name)} Only</option>`).join('');
  }

  function editOffice(id) {
    const o = offices.find(x => x.id === id);
    if (!o) return;
    document.getElementById('officeModalTitle').textContent = 'Edit Office';
    document.getElementById('officeId').value = o.id;
    document.getElementById('officeName').value = o.name;
    document.getElementById('officeCode').value = o.code || '';
    document.getElementById('officeStatus').value = o.status || 'active';

    const secretKeyGroup = document.getElementById('officeSecretKeyGroup');
    if (secretKeyGroup) {
      secretKeyGroup.classList.remove('hidden');
      document.getElementById('officeSecretKeyDisplay').value = o.secret_key || '';
    }
    openModal('officeModal');
  }

  const copyOfficeModalKeyBtn = document.getElementById('copyOfficeModalKeyBtn');
  if (copyOfficeModalKeyBtn) {
    copyOfficeModalKeyBtn.addEventListener('click', () => {
      const val = document.getElementById('officeSecretKeyDisplay').value;
      if (val) {
        navigator.clipboard.writeText(val);
        showToast('Office secret key copied to clipboard!');
      }
    });
  }

  async function deleteOffice(id) {
    if (!confirm('Are you sure you want to delete this office? All accounts under this office will also be removed!')) return;
    try {
      await api(`/api/admin/offices/${id}`, { method: 'DELETE' });
      showToast('Office deleted');
      await loadOffices();
      await loadAccounts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('addOfficeBtn').addEventListener('click', () => {
    document.getElementById('officeModalTitle').textContent = 'Add Office / Branch';
    document.getElementById('officeForm').reset();
    document.getElementById('officeId').value = '';
    const secretKeyGroup = document.getElementById('officeSecretKeyGroup');
    if (secretKeyGroup) secretKeyGroup.classList.add('hidden');
    openModal('officeModal');
  });

  document.getElementById('officeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('officeId').value;
    const payload = {
      name: document.getElementById('officeName').value.trim(),
      code: document.getElementById('officeCode').value.trim(),
      status: document.getElementById('officeStatus').value
    };

    try {
      if (id) {
        await api(`/api/admin/offices/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Office updated');
      } else {
        const res = await api('/api/admin/offices', { method: 'POST', body: JSON.stringify(payload) });
        showToast(`Office "${res.office.name}" created with secret key!`);
      }
      closeModal('officeModal');
      await loadOffices();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- Accounts ---------------- //
  async function loadAccounts() {
    try {
      const officeFilter = document.getElementById('accountOfficeFilter').value;
      const url = officeFilter ? `/api/admin/accounts?office_id=${officeFilter}` : '/api/admin/accounts';
      const data = await api(url);
      accounts = data.accounts || [];
      renderAccounts();
    } catch (err) {
      showToast('Failed to load accounts: ' + err.message, 'error');
    }
  }

  function renderAccounts() {
    const tbody = document.getElementById('accountsTableBody');
    const query = document.getElementById('accountSearchInput').value.toLowerCase().trim();

    const filtered = accounts.filter(a => {
      const matchSearch = a.display_name.toLowerCase().includes(query) ||
                          a.email.toLowerCase().includes(query) ||
                          a.office_name.toLowerCase().includes(query);
      return matchSearch;
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No Steadfast accounts found. Click "Add New Account" above.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td><span class="badge badge-blue">${escapeHtml(a.office_name)}</span></td>
        <td><strong>${escapeHtml(a.display_name)}</strong></td>
        <td><code>${escapeHtml(a.email)}</code></td>
        <td><span class="badge badge-warning" title="Encrypted with AES-256-GCM">•••••••• (Encrypted)</span></td>
        <td><span class="badge badge-${a.status === 'active' ? 'active' : 'inactive'}">${a.status}</span></td>
        <td class="text-muted" style="font-size: 0.8rem;">${new Date(a.updated_at).toLocaleString()}</td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn-action edit-account-btn" data-id="${a.id}">Edit / Change Password</button>
            <button class="btn-action btn-action-danger delete-account-btn" data-id="${a.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-account-btn').forEach(b => {
      b.addEventListener('click', () => editAccount(b.dataset.id));
    });
    tbody.querySelectorAll('.delete-account-btn').forEach(b => {
      b.addEventListener('click', () => deleteAccount(b.dataset.id));
    });
  }

  document.getElementById('accountSearchInput').addEventListener('input', renderAccounts);
  document.getElementById('accountOfficeFilter').addEventListener('change', loadAccounts);

  document.getElementById('addAccountBtn').addEventListener('click', () => {
    document.getElementById('accountModalTitle').textContent = 'Add Steadfast Account';
    document.getElementById('accountForm').reset();
    document.getElementById('accountId').value = '';
    document.getElementById('accountPassword').required = true;
    openModal('accountModal');
  });

  async function editAccount(id) {
    try {
      const data = await api(`/api/admin/accounts/${id}`);
      const a = data.account;
      document.getElementById('accountModalTitle').textContent = 'Edit Account & Password';
      document.getElementById('accountId').value = a.id;
      document.getElementById('accountOfficeId').value = a.office_id;
      document.getElementById('accountDisplayName').value = a.display_name;
      document.getElementById('accountEmail').value = a.email;
      document.getElementById('accountPassword').value = a.password;
      document.getElementById('accountPassword').required = true;
      document.getElementById('accountStatus').value = a.status;
      openModal('accountModal');
    } catch (err) {
      showToast('Failed to load account details: ' + err.message, 'error');
    }
  }

  async function deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      await api(`/api/admin/accounts/${id}`, { method: 'DELETE' });
      showToast('Account deleted');
      await loadAccounts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('accountId').value;
    const payload = {
      office_id: document.getElementById('accountOfficeId').value,
      display_name: document.getElementById('accountDisplayName').value.trim(),
      email: document.getElementById('accountEmail').value.trim(),
      password: document.getElementById('accountPassword').value,
      status: document.getElementById('accountStatus').value
    };

    try {
      if (id) {
        await api(`/api/admin/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Account & Password updated! Real-time sync active.');
      } else {
        await api('/api/admin/accounts', { method: 'POST', body: JSON.stringify(payload) });
        showToast('New Steadfast account added successfully!');
      }
      closeModal('accountModal');
      await loadAccounts();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- Extension Tokens ---------------- //
  async function loadTokens() {
    try {
      const data = await api('/api/admin/tokens');
      tokens = data.tokens || [];
      renderTokens();

      // update sample token in guide modal
      if (tokens.length > 0) {
        const activeToken = tokens.find(t => t.status === 'active') || tokens[0];
        document.getElementById('guideSampleToken').value = activeToken.token;
      }
    } catch (err) {
      showToast('Failed to load tokens: ' + err.message, 'error');
    }
  }

  function renderTokens() {
    const tbody = document.getElementById('tokensTableBody');
    if (!tokens.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No tokens generated yet. Click "Generate New Token" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = tokens.map(t => {
      let scopeLabel = 'All Offices';
      if (t.allowed_office_ids !== 'all') {
        const found = offices.find(o => o.id === t.allowed_office_ids);
        scopeLabel = found ? found.name : 'Single Office';
      }

      return `
        <tr>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td><span class="badge badge-purple">${escapeHtml(scopeLabel)}</span></td>
          <td>
            <div class="d-flex align-center gap-2">
              <code>${escapeHtml(t.token)}</code>
              <button class="btn-action copy-token-btn" data-token="${t.token}">Copy</button>
            </div>
          </td>
          <td><span class="badge badge-${t.status === 'active' ? 'active' : 'inactive'}">${t.status}</span></td>
          <td class="text-muted" style="font-size: 0.8rem;">${new Date(t.created_at).toLocaleDateString()}</td>
          <td class="text-right">
            <button class="btn-action btn-action-danger delete-token-btn" data-id="${t.id}">Revoke</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.copy-token-btn').forEach(b => {
      b.addEventListener('click', () => {
        navigator.clipboard.writeText(b.dataset.token);
        showToast('Token copied to clipboard!');
      });
    });

    tbody.querySelectorAll('.delete-token-btn').forEach(b => {
      b.addEventListener('click', () => deleteToken(b.dataset.id));
    });
  }

  document.getElementById('addTokenBtn').addEventListener('click', () => {
    document.getElementById('tokenForm').reset();
    openModal('tokenModal');
  });

  document.getElementById('tokenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('tokenName').value.trim(),
      allowed_office_ids: document.getElementById('tokenOfficeScope').value
    };

    try {
      const res = await api('/api/admin/tokens', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Token generated: ' + res.token.name);
      closeModal('tokenModal');
      await loadTokens();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  async function deleteToken(id) {
    if (!confirm('Are you sure you want to revoke this extension token? Employees using it will lose access!')) return;
    try {
      await api(`/api/admin/tokens/${id}`, { method: 'DELETE' });
      showToast('Token revoked');
      await loadTokens();
      loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------------- Audit Logs ---------------- //
  async function loadLogs() {
    try {
      const data = await api('/api/admin/logs?limit=50');
      const tbody = document.getElementById('logsTableBody');
      const logs = data.logs || [];

      if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No activity logs recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td class="text-muted" style="font-size: 0.82rem;">${new Date(l.timestamp).toLocaleString()}</td>
          <td><span class="badge badge-blue">${escapeHtml(l.office_name || 'N/A')}</span></td>
          <td><strong>${escapeHtml(l.display_name || 'Account')}</strong></td>
          <td><code>${escapeHtml(l.token_name || 'Extension')}</code></td>
          <td><code>${escapeHtml(l.ip || 'Unknown')}</code></td>
          <td><span class="badge badge-success">Auto-Login Success</span></td>
        </tr>
      `).join('');
    } catch (err) {
      showToast('Failed to load logs: ' + err.message, 'error');
    }
  }

  document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);

  // ---------------- Settings ---------------- //
  async function loadSettings() {
    try {
      const data = await api('/api/admin/settings');
      settings = data.settings || {};
      document.getElementById('settingStoreUrl').value = settings.chrome_web_store_url || '';
      document.getElementById('settingSystemTitle').value = settings.system_title || '';
      document.getElementById('settingAdminUsername').value = settings.admin_username || '';

      if (settings.system_title) {
        document.getElementById('systemTitleDisplay').textContent = settings.system_title;
      }
      if (settings.chrome_web_store_url) {
        document.getElementById('modalStoreDirectBtn').href = settings.chrome_web_store_url;
      }
    } catch (err) {
      showToast('Failed to load settings: ' + err.message, 'error');
    }
  }

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      chrome_web_store_url: document.getElementById('settingStoreUrl').value.trim(),
      system_title: document.getElementById('settingSystemTitle').value.trim(),
      admin_username: document.getElementById('settingAdminUsername').value.trim()
    };

    try {
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Settings saved successfully!');
      loadSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- Change Password Modal ---------------- //
  document.getElementById('changePwBtn').addEventListener('click', () => {
    document.getElementById('changePwForm').reset();
    openModal('changePwModal');
  });

  document.getElementById('changePwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentAdminPw').value;
    const newPassword = document.getElementById('newAdminPw').value;
    const confirmPassword = document.getElementById('confirmAdminPw').value;

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match!', 'error');
      return;
    }

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showToast('Admin password changed successfully!');
      sessionStorage.removeItem('sflm_warn_default_pw');
      document.getElementById('defaultPwBanner').classList.add('hidden');
      closeModal('changePwModal');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------------- Chrome Extension Guide Modal ---------------- //
  const extensionGuideModal = document.getElementById('extensionGuideModal');
  const openExtensionGuideBtn = document.getElementById('openExtensionGuideBtn');

  openExtensionGuideBtn.addEventListener('click', () => {
    document.getElementById('guideServerUrl').value = window.location.origin;
    openModal('extensionGuideModal');
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        navigator.clipboard.writeText(input.value);
        showToast('Copied to clipboard!');
      }
    });
  });

  // ---------------- Backup & Restore Handlers ---------------- //
  const downloadBackupBtn = document.getElementById('downloadBackupBtn');
  if (downloadBackupBtn) {
    downloadBackupBtn.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('sflm_admin_token');
        const res = await fetch('/api/admin/backup/export', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Failed to export backup');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `steadfast_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Database backup downloaded successfully!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const restoreBackupInput = document.getElementById('restoreBackupInput');
  if (restoreBackupInput) {
    restoreBackupInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!confirm(`Restore database from "${file.name}"? This will sync all offices and accounts.`)) {
        restoreBackupInput.value = '';
        return;
      }

      try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        await api('/api/admin/backup/import', {
          method: 'POST',
          body: JSON.stringify({ backupData })
        });
        showToast('Database restored successfully!');
        loadOffices().then(() => {
          loadAccounts();
          loadTokens();
          loadStats();
          loadSettings();
        });
      } catch (err) {
        showToast('Failed to restore backup: ' + err.message, 'error');
      } finally {
        restoreBackupInput.value = '';
      }
    });
  }

  // Modal helpers
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.add('hidden');
    }
  });

  // Sign out
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      localStorage.removeItem('sflm_admin_token');
      localStorage.removeItem('sflm_admin_user');
      window.location.href = '/login.html';
    }
  });

  // Safe HTML Escaping
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  loadOffices().then(() => {
    loadAccounts();
    loadTokens();
    loadStats();
    loadSettings();
  });
});
