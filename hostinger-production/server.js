const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Built-in zero-dependency .env loader (compatible with all Node versions)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

const db = require('./database');
const {
  rateLimitLogin,
  signAdminToken,
  requireAdmin,
  requireExtensionToken
} = require('./auth');

// Initialize database & tables
db.init();

const app = express();
const PORT = process.env.PORT || 3000;

// Production: Trust reverse proxy (Nginx, Cloudflare, Hostinger LiteSpeed)
app.set('trust proxy', 1);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-Token']
}));

app.use(express.json());

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- Public & Auth Endpoints ---------------- //

// Public metadata (for login page & extension quick-link)
app.get('/api/auth/public-info', (req, res) => {
  const storeUrl = db.getSetting('chrome_web_store_url') || 'https://chromewebstore.google.com/';
  const systemTitle = db.getSetting('system_title') || 'Steadfast Secure Auto Login';
  res.json({
    ok: true,
    chromeWebStoreUrl: storeUrl,
    systemTitle
  });
});

// Admin Login
app.post('/api/auth/login', rateLimitLogin, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password are required' });
  }

  const storedUsername = db.getSetting('admin_username') || 'admin';
  const storedHash = db.getSetting('admin_password_hash');

  if (username.trim() !== storedUsername) {
    if (req.loginAttemptTracker) req.loginAttemptTracker.recordFailure();
    return res.status(401).json({ ok: false, error: 'Invalid credentials. Only Administrator is allowed.' });
  }

  const isMatch = bcrypt.compareSync(password, storedHash);
  if (!isMatch) {
    if (req.loginAttemptTracker) req.loginAttemptTracker.recordFailure();
    return res.status(401).json({ ok: false, error: 'Invalid credentials. Only Administrator is allowed.' });
  }

  if (req.loginAttemptTracker) req.loginAttemptTracker.reset();

  const token = signAdminToken(username);
  res.json({
    ok: true,
    token,
    username,
    chromeWebStoreUrl: db.getSetting('chrome_web_store_url'),
    isDefaultPassword: password === 'admin123456'
  });
});

// Verify token
app.get('/api/auth/verify', requireAdmin, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

// Change Admin Password
app.post('/api/auth/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters long' });
  }

  const storedHash = db.getSetting('admin_password_hash');
  if (!bcrypt.compareSync(currentPassword, storedHash)) {
    return res.status(400).json({ ok: false, error: 'Current password does not match' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  db.setSetting('admin_password_hash', newHash);

  res.json({ ok: true, message: 'Password updated successfully!' });
});

// ---------------- Admin Office Management ---------------- //

app.get('/api/admin/offices', requireAdmin, (req, res) => {
  const offices = db.getOffices();
  res.json({ ok: true, offices });
});

app.post('/api/admin/offices', requireAdmin, (req, res) => {
  const { name, code, status } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Office name is required' });
  }
  const office = db.createOffice({
    name: name.trim(),
    code: code ? code.trim() : '',
    status: status || 'active'
  });
  res.json({ ok: true, office });
});

app.put('/api/admin/offices/:id', requireAdmin, (req, res) => {
  const updated = db.updateOffice(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ ok: false, error: 'Office not found' });
  }
  res.json({ ok: true, office: updated });
});

app.post('/api/admin/offices/:id/regenerate-key', requireAdmin, (req, res) => {
  const updated = db.regenerateOfficeSecretKey(req.params.id);
  if (!updated) {
    return res.status(404).json({ ok: false, error: 'Office not found' });
  }
  res.json({ ok: true, office: updated, message: 'Office secret key regenerated successfully!' });
});

app.delete('/api/admin/offices/:id', requireAdmin, (req, res) => {
  db.deleteOffice(req.params.id);
  res.json({ ok: true, message: 'Office deleted successfully' });
});

// ---------------- Admin Account Management ---------------- //

app.get('/api/admin/accounts', requireAdmin, (req, res) => {
  const officeId = req.query.office_id || null;
  const accounts = db.getAccounts(officeId);
  res.json({ ok: true, accounts });
});

app.get('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  const account = db.getAccount(req.params.id);
  if (!account) {
    return res.status(404).json({ ok: false, error: 'Account not found' });
  }
  res.json({ ok: true, account });
});

app.post('/api/admin/accounts', requireAdmin, (req, res) => {
  const { office_id, display_name, email, password, status } = req.body || {};
  if (!office_id || !display_name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Office, Display Name, Email, and Password are all required' });
  }
  const account = db.createAccount({
    office_id,
    display_name: display_name.trim(),
    email: email.trim(),
    password,
    status: status || 'active'
  });
  res.json({ ok: true, account });
});

app.put('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  const updated = db.updateAccount(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ ok: false, error: 'Account not found' });
  }
  res.json({ ok: true, account: updated });
});

app.delete('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  db.deleteAccount(req.params.id);
  res.json({ ok: true, message: 'Account deleted successfully' });
});

// ---------------- Admin Token Management (For Extension) ---------------- //

app.get('/api/admin/tokens', requireAdmin, (req, res) => {
  const tokens = db.getTokens();
  res.json({ ok: true, tokens });
});

app.post('/api/admin/tokens', requireAdmin, (req, res) => {
  const { name, allowed_office_ids, status } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Token description name is required' });
  }
  const token = db.createToken({
    name: name.trim(),
    allowed_office_ids: allowed_office_ids || 'all',
    status: status || 'active'
  });
  res.json({ ok: true, token });
});

app.put('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  const updated = db.updateToken(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ ok: false, error: 'Token not found' });
  }
  res.json({ ok: true, token: updated });
});

app.delete('/api/admin/tokens/:id', requireAdmin, (req, res) => {
  db.deleteToken(req.params.id);
  res.json({ ok: true, message: 'Token deleted' });
});

// ---------------- Admin Stats, Settings & Logs ---------------- //

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const offices = db.getOffices();
  const accounts = db.getAccounts();
  const tokens = db.getTokens();
  const logs = db.getAuditLogs(100);

  const today = new Date().toISOString().slice(0, 10);
  const todayLogins = logs.filter(l => l.timestamp && l.timestamp.startsWith(today)).length;

  res.json({
    ok: true,
    stats: {
      totalOffices: offices.length,
      totalAccounts: accounts.length,
      activeTokens: tokens.filter(t => t.status === 'active').length,
      todayLogins
    }
  });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const logs = db.getAuditLogs(limit);
  res.json({ ok: true, logs });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ ok: true, settings: db.getAllSettings() });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { chrome_web_store_url, system_title, admin_username } = req.body || {};
  if (chrome_web_store_url !== undefined) db.setSetting('chrome_web_store_url', chrome_web_store_url.trim());
  if (system_title !== undefined) db.setSetting('system_title', system_title.trim());
  if (admin_username !== undefined && admin_username.trim()) db.setSetting('admin_username', admin_username.trim());

  res.json({ ok: true, message: 'Settings saved successfully', settings: db.getAllSettings() });
});

// Database Backup & Restore Endpoints
app.get('/api/admin/backup/export', requireAdmin, (req, res) => {
  const data = db.exportDatabaseJson();
  if (!data) {
    return res.status(500).json({ ok: false, error: 'Could not export database' });
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="steadfast_backup_${dateStr}.json"`);
  res.json(data);
});

app.post('/api/admin/backup/import', requireAdmin, (req, res) => {
  const { backupData } = req.body || {};
  if (!backupData || (!backupData.offices && !backupData.accounts)) {
    return res.status(400).json({ ok: false, error: 'Invalid backup format' });
  }
  const ok = db.importDatabaseJson(backupData);
  if (!ok) {
    return res.status(500).json({ ok: false, error: 'Failed to restore database backup' });
  }
  res.json({ ok: true, message: 'Database backup restored successfully!' });
});

// ---------------- Extension Client Endpoints ---------------- //

// Ping endpoint for testing extension connectivity
app.get('/api/extension/ping', requireExtensionToken, (req, res) => {
  res.json({
    ok: true,
    server: 'SteadfastSecureLoginServer',
    tokenName: req.extensionToken.name,
    officeName: req.extensionToken.name,
    officeId: req.extensionToken.office_id || null,
    allowedOffices: req.extensionToken.allowed_office_ids
  });
});

// Get available accounts grouped by office (NO PASSWORDS returned here)
app.get('/api/extension/accounts', requireExtensionToken, (req, res) => {
  const token = req.extensionToken;
  const allowed = token.allowed_office_ids; // 'all' or comma-separated office IDs

  const allOffices = db.getOffices().filter(o => o.status === 'active');
  const allowedOffices = allowed === 'all'
    ? allOffices
    : allOffices.filter(o => allowed.split(',').map(s => s.trim()).includes(o.id));

  const officeMap = new Map();
  for (const off of allowedOffices) {
    officeMap.set(off.id, {
      id: off.id,
      name: off.name,
      code: off.code,
      accounts: []
    });
  }

  const allAccounts = db.getAccounts().filter(a => a.status === 'active');
  for (const acc of allAccounts) {
    if (officeMap.has(acc.office_id)) {
      officeMap.get(acc.office_id).accounts.push({
        id: acc.id,
        displayName: acc.display_name,
        officeId: acc.office_id
      });
    }
  }

  const result = Array.from(officeMap.values()).filter(o => o.accounts.length > 0);
  res.json({ ok: true, offices: result });
});

// Real-time Credential Fetch for Immediate Login Fill & Submit
app.post('/api/extension/login-fill', requireExtensionToken, (req, res) => {
  const { account_id } = req.body || {};
  if (!account_id) {
    return res.status(400).json({ ok: false, error: 'account_id is required' });
  }

  const account = db.getAccount(account_id);
  if (!account || account.status !== 'active') {
    return res.status(404).json({ ok: false, error: 'Account not found or inactive' });
  }

  // Check token scope
  const token = req.extensionToken;
  if (token.allowed_office_ids !== 'all') {
    const allowed = token.allowed_office_ids.split(',').map(s => s.trim());
    if (!allowed.includes(account.office_id)) {
      return res.status(403).json({ ok: false, error: 'This extension token is not authorized for this office' });
    }
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  // Log the successful automated login request in the audit logs
  db.addAuditLog({
    account_id: account.id,
    office_name: account.office_name,
    display_name: account.display_name,
    token_name: token.name,
    ip: String(ip),
    user_agent: userAgent,
    status: 'success'
  });

  // Return the latest credentials in memory directly for the extension content script
  res.json({
    ok: true,
    credentials: {
      email: account.email,
      password: account.password
    }
  });
});

// Fallback route for Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful server startup
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`Steadfast Secure Login Server running on port ${PORT}`);
  console.log(`Admin Panel: http://localhost:${PORT}`);
  console.log(`Default Login: admin / admin123456`);
  console.log(`Production Ready: Hostinger VPS / PM2 / Nginx`);
  console.log(`=================================================`);
});

// Graceful shutdown handling for PM2 and Docker
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
